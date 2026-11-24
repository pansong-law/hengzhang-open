"""Build the combined advisory+project+litigation Excel import template from lib/case-ledger-fields.js."""
import json
import subprocess
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'public' / 'templates'


def load_spec():
    raw = subprocess.check_output(
        [
            'node',
            '--input-type=module',
            '-e',
            "import {COMBINED_LEDGER_TEMPLATE} from './lib/case-ledger-fields.js';"
            "import {LITIGATION_STAGES} from './lib/litigation-stage.js';"
            'console.log(JSON.stringify({template:COMBINED_LEDGER_TEMPLATE,stages:LITIGATION_STAGES}));',
        ],
        cwd=ROOT,
        text=True,
    )
    return json.loads(raw)


def main():
    data = load_spec()
    tpl = data['template']
    stages = data['stages']
    fields = tpl['fields']
    OUTPUT.mkdir(parents=True, exist_ok=True)

    wb = Workbook()
    ws = wb.active
    ws.title = tpl['name']
    ws.views.sheetView[0].showGridLines = False

    thin_side = Side(style='thin', color='E2EAEE')
    data_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
    header_font = Font(name='Arial', size=11, bold=True, color='FFFFFF')
    body_font = Font(name='Arial', size=11, color='22343D')
    header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
    body_align = Alignment(horizontal='left', vertical='center')

    ws.row_dimensions[1].height = 34
    wide_keys = {
        'client', 'service_period', 'name', 'opponent',
        'plaintiff', 'defendant', 'third_party', 'case_type',
        'service_stages', 'fee_note', 'notes',
    }
    money_keys = {
        'contract_amount', 'invoice_amount', 'collected_amount',
        'unpaid', 'invoiced_unpaid',
    }
    validations = {
        'track': tpl['trackLabels'],
        'case_stage': stages,
        'status': ['在办', '已结', '中止'],
        'unpaid_mode': ['自动', '手填'],
        'invoiced_unpaid_mode': ['自动', '手填'],
    }
    scope_tint = {
        'required': 'FFFBF4',
        'advisory': 'F4FAF7',
        'project': 'FCF9F2',
        'litigation': 'F4F6FB',
    }

    for idx, f in enumerate(fields, start=1):
        col_letter = get_column_letter(idx)
        cell = ws.cell(row=1, column=idx, value=f['label'])
        cell.font = header_font
        cell.fill = PatternFill(fill_type='solid', fgColor=f['color'])
        cell.alignment = header_align
        comment = Comment(f['note'], '')
        comment.width = 320
        comment.height = 110
        cell.comment = comment

        width = 30 if f['key'] in wide_keys else (22 if f['key'] in {'case_stage', 'internal_no', 'unpaid_mode', 'invoiced_unpaid_mode'} else 18)
        ws.column_dimensions[col_letter].width = width

        num_fmt = '#,##0.00' if f['key'] in money_keys else ('yyyy-mm-dd' if f['key'] == 'sign_date' else '@')
        tint = scope_tint.get(f['scope'])
        col_fill = PatternFill(fill_type='solid', fgColor=tint) if tint else None
        for r in range(2, 502):
            c = ws.cell(row=r, column=idx)
            c.font = body_font
            c.alignment = body_align
            c.number_format = num_fmt
            c.border = data_border
            if col_fill is not None:
                c.fill = col_fill

        if f['key'] in validations:
            choices = ','.join(validations[f['key']])
            dv = DataValidation(type='list', formula1=f'"{choices}"', allow_blank=True)
            dv.promptTitle = f['label']
            dv.prompt = f'请从下拉列表选择：{choices}'
            ws.add_data_validation(dv)
            dv.add(f'{col_letter}2:{col_letter}501')

    for r in range(2, 502):
        ws.row_dimensions[r].height = 24
    ws.freeze_panes = 'C2'

    # Sheet 2: 填写说明
    guide = wb.create_sheet('填写说明')
    guide.views.sheetView[0].showGridLines = False
    guide.column_dimensions['A'].width = 26
    guide.column_dimensions['B'].width = 24
    guide.column_dimensions['C'].width = 36
    guide.column_dimensions['D'].width = 58

    title_font = Font(name='Arial', size=15, bold=True, color='294C60')
    section_font = Font(name='Arial', size=12, bold=True, color='294C60')
    th_fill = PatternFill(fill_type='solid', fgColor='294C60')
    th_font = Font(name='Arial', size=11, bold=True, color='FFFFFF')
    label_font = Font(name='Arial', size=11, bold=True, color='22343D')
    text_font = Font(name='Arial', size=11, color='22343D')
    wrap_left = Alignment(horizontal='left', vertical='center', wrap_text=True)
    center_align = Alignment(horizontal='center', vertical='center', wrap_text=True)

    guide['A2'] = '综合案件导入模板（顾问 + 专项 + 诉讼）填写说明'
    guide['A2'].font = title_font
    guide.row_dimensions[2].height = 30

    intro_rows = [
        ('填写方法', '在第一张工作表「综合案件」第 2 行起填写，一行一个案件。保留第 1 行表头，不要插入示例行或合计行。'),
        ('业务线区分', '第 1 列「类型」为必填下拉（顾问 / 专项 / 诉讼）。各业务线专属列已用不同表头颜色与列名后缀标注，不适用于当前行类型的专属列请留空；若误填其他业务线专属列，系统会提示定位并拒绝本次导入，避免串行。'),
        ('更新已有案件', '填写与本机台账一致的唯一「内部案号」时将合并更新（非空字段以本次导入为准），此时「类型」可留空并沿用原业务线。'),
        ('金额、计算方式与日期', '金额单位为元，日期为年-月-日；未付/开票未付计算方式填「自动」可恢复自动计算，填「手填」须填写对应金额。与衡账网络版导出的 23 列综合表同样兼容。'),
    ]
    row_no = 3
    for k, v in intro_rows:
        guide.merge_cells(start_row=row_no, start_column=2, end_row=row_no, end_column=4)
        guide.cell(row=row_no, column=1, value=k).font = label_font
        guide.cell(row=row_no, column=1).alignment = wrap_left
        guide.cell(row=row_no, column=2, value=v).font = text_font
        guide.cell(row=row_no, column=2).alignment = wrap_left
        guide.row_dimensions[row_no].height = 36
        row_no += 1

    row_no += 1
    guide.cell(row=row_no, column=1, value='一、表头配色与列分组').font = section_font
    guide.row_dimensions[row_no].height = 26
    row_no += 1
    legend_colors = ['85511E', '294C60', '2A6F5B', '7A5A2B', '3D4F7C']
    guide.merge_cells(start_row=row_no, start_column=3, end_row=row_no, end_column=4)
    for col_i, text in [(1, '分组配色'), (2, '包含列'), (3, '填写原则')]:
        c = guide.cell(row=row_no, column=col_i, value=text)
        c.fill = th_fill
        c.font = th_font
        c.alignment = center_align
    guide.row_dimensions[row_no].height = 28
    row_no += 1
    for (group_name, cols_text, rule_text), hex_color in zip(tpl['colorLegend'], legend_colors):
        guide.merge_cells(start_row=row_no, start_column=3, end_row=row_no, end_column=4)
        c1 = guide.cell(row=row_no, column=1, value=group_name)
        c1.fill = PatternFill(fill_type='solid', fgColor=hex_color)
        c1.font = th_font
        c1.alignment = center_align
        c2 = guide.cell(row=row_no, column=2, value=cols_text)
        c2.font = text_font
        c2.alignment = wrap_left
        c2.border = data_border
        c3 = guide.cell(row=row_no, column=3, value=rule_text)
        c3.font = text_font
        c3.alignment = wrap_left
        c3.border = data_border
        guide.cell(row=row_no, column=4).border = data_border
        guide.row_dimensions[row_no].height = 34
        row_no += 1

    row_no += 1
    guide.cell(row=row_no, column=1, value='二、顾问 / 专项 / 诉讼核心字段填写差异').font = section_font
    guide.row_dimensions[row_no].height = 26
    row_no += 1
    for col_i, text in [(1, '类型'), (2, '「客户」列填写要求'), (3, '专属名称 / 主体 / 案由列'), (4, '期限 / 阶段列填写要求')]:
        c = guide.cell(row=row_no, column=col_i, value=text)
        c.fill = th_fill
        c.font = th_font
        c.alignment = center_align
    guide.row_dimensions[row_no].height = 28
    row_no += 1
    comp_colors = ['2A6F5B', '7A5A2B', '3D4F7C']
    for row_vals, hex_color in zip(tpl['trackComparison'], comp_colors):
        for col_i, val in enumerate(row_vals, start=1):
            c = guide.cell(row=row_no, column=col_i, value=val)
            if col_i == 1:
                c.fill = PatternFill(fill_type='solid', fgColor=hex_color)
                c.font = th_font
                c.alignment = center_align
            else:
                c.font = text_font
                c.alignment = wrap_left
                c.border = data_border
        guide.row_dimensions[row_no].height = 46
        row_no += 1

    row_no += 1
    guide.cell(row=row_no, column=1, value='三、全部字段逐项填写要求').font = section_font
    guide.row_dimensions[row_no].height = 26
    row_no += 1
    guide.merge_cells(start_row=row_no, start_column=3, end_row=row_no, end_column=4)
    for col_i, text in [(1, '字段'), (2, '适用业务线'), (3, '填写要求')]:
        c = guide.cell(row=row_no, column=col_i, value=text)
        c.fill = th_fill
        c.font = th_font
        c.alignment = center_align
    guide.row_dimensions[row_no].height = 28
    row_no += 1
    for f in fields:
        guide.merge_cells(start_row=row_no, start_column=3, end_row=row_no, end_column=4)
        c1 = guide.cell(row=row_no, column=1, value=f['label'])
        c1.font = label_font
        c1.alignment = wrap_left
        c1.border = data_border
        c2 = guide.cell(row=row_no, column=2, value=f['scopeLabel'])
        c2.fill = PatternFill(fill_type='solid', fgColor=f['color'])
        c2.font = th_font
        c2.alignment = center_align
        c3 = guide.cell(row=row_no, column=3, value=f['note'])
        c3.font = text_font
        c3.alignment = wrap_left
        c3.border = data_border
        guide.cell(row=row_no, column=4).border = data_border
        guide.row_dimensions[row_no].height = 40
        row_no += 1

    target = OUTPUT / tpl['file']
    wb.save(target)
    print(f'已生成 {target}')


if __name__ == '__main__':
    main()
