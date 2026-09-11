import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useAsync } from 'react-async-hook';
import {
  Table, Divider, Typography, Button, Toast, Space,
  Popover, Tag, Select, Input,
} from '@douyinfe/semi-ui';
import {
  FieldType,
  IFieldMeta,
  ISelectFieldMeta,
} from '@lark-opdev/block-bitable-api';
import { getTableData } from './utils';

const { Title, Text } = Typography;

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '上午好';
  if (hour >= 12 && hour < 14) return '中午好';
  if (hour >= 14 && hour < 18) return '下午好';
  return '晚上好';
};

/* ---------------- 列宽策略 ---------------- */

const DEFAULT_COL_WIDTH = 150;

const getColumnWidth = (meta?: IFieldMeta): number => {
  if (!meta) return DEFAULT_COL_WIDTH;
  switch (meta.type) {
    case FieldType.Text: return 180;
    case FieldType.Url: return 220;
    case FieldType.Number: return 110;
    case FieldType.DateTime:
    case FieldType.CreatedTime:
    case FieldType.ModifiedTime: return 140;
    case FieldType.SingleSelect: return 130;
    case FieldType.MultiSelect: return 170;
    case FieldType.User:
    case FieldType.CreatedUser:
    case FieldType.ModifiedUser: return 130;
    case FieldType.Checkbox: return 90;
    default: return DEFAULT_COL_WIDTH;
  }
};

/* ---------------- 筛选类型 ---------------- */

interface FilterItem {
  fieldId: string;
  operator: string;
  value: any;
  label: string;
}

const getOperators = (meta: IFieldMeta) => {
  switch (meta.type) {
    case FieldType.Text:
    case FieldType.Url:
      return [
        { value: 'contains', label: '包含' },
        { value: 'notContains', label: '不包含' },
        { value: 'empty', label: '为空' },
        { value: 'notEmpty', label: '不为空' },
      ];
    case FieldType.SingleSelect:
    case FieldType.MultiSelect:
      return [
        { value: 'eq', label: '等于' },
        { value: 'ne', label: '不等于' },
        { value: 'empty', label: '为空' },
        { value: 'notEmpty', label: '不为空' },
      ];
    case FieldType.Checkbox:
      return [{ value: 'eq', label: '等于' }];
    case FieldType.Number:
      return [
        { value: 'eq', label: '等于' },
        { value: 'gt', label: '大于' },
        { value: 'lt', label: '小于' },
        { value: 'gte', label: '大于等于' },
        { value: 'lte', label: '小于等于' },
        { value: 'empty', label: '为空' },
        { value: 'notEmpty', label: '不为空' },
      ];
    default:
      return [
        { value: 'empty', label: '为空' },
        { value: 'notEmpty', label: '不为空' },
      ];
  }
};

const matchFilter = (cellValue: any, meta: IFieldMeta, filter: FilterItem): boolean => {
  const { operator, value } = filter;
  const isEmpty =
    cellValue === null ||
    cellValue === undefined ||
    cellValue === '' ||
    (Array.isArray(cellValue) && cellValue.length === 0);

  if (operator === 'empty') return isEmpty;
  if (operator === 'notEmpty') return !isEmpty;

  switch (meta.type) {
    case FieldType.Text:
    case FieldType.Url: {
      const text = Array.isArray(cellValue)
        ? cellValue.map((s: any) => s?.text ?? '').join('')
        : String(cellValue ?? '');
      const kw = String(value ?? '').toLowerCase();
      const hit = text.toLowerCase().includes(kw);
      return operator === 'contains' ? hit : !hit;
    }
    case FieldType.SingleSelect: {
      const text = cellValue?.text ?? '';
      return operator === 'eq' ? text === value : text !== value;
    }
    case FieldType.MultiSelect: {
      const texts = Array.isArray(cellValue)
        ? cellValue.map((o: any) => o?.text)
        : [];
      const hit = texts.includes(value);
      return operator === 'eq' ? hit : !hit;
    }
    case FieldType.Checkbox:
      return !!cellValue === !!value;
    case FieldType.Number: {
      const num = Number(cellValue);
      const v = Number(value);
      if (Number.isNaN(num) || Number.isNaN(v)) return false;
      switch (operator) {
        case 'eq': return num === v;
        case 'gt': return num > v;
        case 'lt': return num < v;
        case 'gte': return num >= v;
        case 'lte': return num <= v;
        default: return true;
      }
    }
    default:
      return true;
  }
};

/* ---------------- 全局样式 ---------------- */

const GLOBAL_STYLE_ID = 'yyjk-custom-table-style';

const injectGlobalStyle = () => {
  if (document.getElementById(GLOBAL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = GLOBAL_STYLE_ID;
  style.textContent = `
    /* ============ 页面基础 ============ */
    html, body, #root {
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    html::-webkit-scrollbar,
    body::-webkit-scrollbar,
    #root::-webkit-scrollbar {
      width: 0 !important;
      height: 0 !important;
      display: none !important;
    }

    /* ============ 原生横向滚动条隐藏 ============ */
    .semi-table-body::-webkit-scrollbar {
      height: 0 !important;
      width: 0 !important;
    }
    .semi-table-body {
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }

    /* ============ 表格容器撑满 ============ */
    .semi-table,
    .semi-table-wrapper,
    .semi-table-container {
      height: 100% !important;
    }

    /* ============ 表头表体严格对齐 ============ */
    /* 两个 table 都用 fixed 布局，列宽按 colgroup 精确分配 */
    .semi-table-thead > table,
    .semi-table-tbody > table {
      table-layout: fixed !important;
    }

    /* 表头和表体的左右 padding 保持完全一致，消除错位 */
    .semi-table-thead > tr > th,
    .semi-table-tbody > tr > td {
      box-sizing: border-box !important;
      padding-left: 12px !important;
      padding-right: 12px !important;
      overflow: hidden;
    }
    .semi-table-thead > tr > th {
      padding-top: 8px !important;
      padding-bottom: 8px !important;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .semi-table-tbody > tr > td {
      padding-top: 6px !important;
      padding-bottom: 6px !important;
    }

    /* ============ 固定列深色背景 ============ */
    .semi-table-thead > .semi-table-row > .semi-table-row-head[class*="semi-table-cell-fix-right"],
    .semi-table-tbody > .semi-table-row > .semi-table-row-cell[class*="semi-table-cell-fix-right"],
    .semi-table-thead th[class*="fix-right"],
    .semi-table-tbody td[class*="fix-right"] {
      background-color: #1c1f23 !important;
      color: #e8eaed !important;
    }
    .semi-table-thead th[class*="fix-right"] .semi-table-header-title,
    .semi-table-thead th[class*="fix-right"] span,
    .semi-table-thead th[class*="fix-right"] div { color: #e8eaed !important; }
    .semi-table-tbody td[class*="fix-right"] span,
    .semi-table-tbody td[class*="fix-right"] div:not([class*="semi-button"]),
    .semi-table-tbody td[class*="fix-right"] .semi-typography { color: #e8eaed !important; }
    .semi-table-row:hover > td[class*="fix-right"],
    .semi-table-tbody > .semi-table-row:hover > .semi-table-row-cell[class*="fix-right"] {
      background-color: #2a2f36 !important;
    }
    .semi-table-tbody td[class*="semi-table-cell-fix-right-first"]::after,
    .semi-table-thead th[class*="semi-table-cell-fix-right-first"]::after {
      box-shadow: inset 10px 0 8px -8px rgba(0, 0, 0, 0.55) !important;
    }
    .semi-table-thead > tr > th { border-bottom: 1px solid #2a2f36 !important; }

    /* ============ 底部固定滚动条 ============ */
    .yyjk-fake-scrollbar::-webkit-scrollbar { height: 8px; }
    .yyjk-fake-scrollbar::-webkit-scrollbar-track { background: #e8eaed; }
    .yyjk-fake-scrollbar::-webkit-scrollbar-thumb {
      background: #c1c7cf;
      border-radius: 4px;
    }
    .yyjk-fake-scrollbar::-webkit-scrollbar-thumb:hover { background: #a8afb8; }

    /* ============ 表头样式 ============ */
    .semi-table-thead > tr > th:not([class*="fix-right"]) {
      background-color: #f5f7fa !important;
      font-weight: 600 !important;
      color: #1c1f23 !important;
    }
    .semi-table-tbody > .semi-table-row:hover > .semi-table-row-cell:not([class*="fix-right"]) {
      background-color: #f5f9ff !important;
    }

    /* ============ Popover 触发按钮（原生 span，避免 findDOMNode） ============ */
    .yyjk-filter-trigger {
      display: inline-flex;
      align-items: center;
      height: 24px;
      padding: 0 10px;
      font-size: 12px;
      color: #1c1f23;
      background: #f0f1f3;
      border: 1px solid #e0e3e8;
      border-radius: 4px;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s;
    }
    .yyjk-filter-trigger:hover {
      background: #e6e9ed;
      border-color: #c9cdd4;
    }
  `;
  document.head.appendChild(style);
};

/* ---------------- 图片下载工具 ---------------- */

const fetchImageBlob = async (url: string): Promise<Blob> => {
  try {
    const response = await fetch(url);
    return await response.blob();
  } catch {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('转换失败'));
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = url;
    });
  }
};

const downloadImage = async (url: string, filename: string) => {
  try {
    const blob = await fetchImageBlob(url);
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (e) {
    console.error('下载图片失败:', e);
  }
};

const downloadImages = async (urls: string[], prefix = 'image') => {
  for (let i = 0; i < urls.length; i++) {
    await downloadImage(urls[i], `${prefix}_${i + 1}.png`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

/* ---------------- 主组件 ---------------- */

export const App = () => {
  const response = useAsync(getTableData, []);
  const greeting = useMemo(() => getGreeting(), []);
  const [exporting, setExporting] = useState(false);

  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const tableBodyRef = useRef<HTMLDivElement | null>(null);
  const fakeScrollRef = useRef<HTMLDivElement | null>(null);
  const [fakeScrollWidth, setFakeScrollWidth] = useState(0);
  const [showFakeScroll, setShowFakeScroll] = useState(false);
  const [tableBodyHeight, setTableBodyHeight] = useState(400);

  const [filters, setFilters] = useState<FilterItem[]>([]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [pendingFieldId, setPendingFieldId] = useState<string>('');
  const [pendingOperator, setPendingOperator] = useState<string>('');
  const [pendingValue, setPendingValue] = useState<any>(null);

  const hasResult = !!response.result;
  const columns = response.result?.columns ?? [];
  const dataSource = response.result?.dataSource ?? [];
  const table = response.result?.table;
  const fieldMetaMap = response.result?.fieldMetaMap;

  useEffect(() => {
    injectGlobalStyle();
  }, []);

  /* ---------------- 实测表格 body 高度 ---------------- */

  useEffect(() => {
    if (!hasResult) return;

    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;

    let rafId = 0;
    const measure = () => {
      const wrapperHeight = wrapper.clientHeight;
      if (wrapperHeight <= 0) return;

      const head = wrapper.querySelector('.semi-table-thead') as HTMLElement | null;
      const headHeight = head?.offsetHeight || 40;

      const bodyHeight = Math.max(120, wrapperHeight - headHeight - 1);
      setTableBodyHeight(bodyHeight);
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    };

    scheduleMeasure();
    const t1 = setTimeout(scheduleMeasure, 300);
    const t2 = setTimeout(scheduleMeasure, 800);

    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(wrapper);

    window.addEventListener('resize', scheduleMeasure);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [hasResult, dataSource, filters]);

  /* ---------------- 底部固定滚动条 ---------------- */

  useEffect(() => {
    if (!hasResult) return;

    const timer = setTimeout(() => {
      const body = document.querySelector('.semi-table-body') as HTMLDivElement | null;
      if (!body) return;
      tableBodyRef.current = body;

      const sync = () => {
        const sw = body.scrollWidth;
        const cw = body.clientWidth;
        setFakeScrollWidth(sw);
        setShowFakeScroll(sw > cw + 1);
      };
      sync();

      const ro = new ResizeObserver(sync);
      ro.observe(body);

      return () => ro.disconnect();
    }, 500);

    return () => clearTimeout(timer);
  }, [hasResult, dataSource, tableBodyHeight]);

  useEffect(() => {
    const body = tableBodyRef.current;
    if (!body || !showFakeScroll) return;

    const onScroll = () => {
      if (fakeScrollRef.current) {
        fakeScrollRef.current.scrollLeft = body.scrollLeft;
      }
    };
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => body.removeEventListener('scroll', onScroll);
  }, [showFakeScroll, fakeScrollWidth]);

  const handleFakeScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (tableBodyRef.current) {
      tableBodyRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  /* ---------------- 筛选 ---------------- */

  useEffect(() => {
    if (!pendingFieldId || !fieldMetaMap) return;
    const meta = fieldMetaMap.get(pendingFieldId);
    if (!meta) return;
    const ops = getOperators(meta);
    setPendingOperator(ops[0]?.value ?? '');
    setPendingValue(null);
  }, [pendingFieldId, fieldMetaMap]);

  const filteredData = useMemo(() => {
    if (!filters.length || !fieldMetaMap) return dataSource;
    return dataSource.filter((record: any) =>
      filters.every((f) => {
        const meta = fieldMetaMap.get(f.fieldId);
        if (!meta) return true;
        return matchFilter(record[f.fieldId], meta, f);
      })
    );
  }, [dataSource, filters, fieldMetaMap]);

  const handleAddFilter = () => {
    if (!pendingFieldId || !pendingOperator || !fieldMetaMap) return;
    const meta = fieldMetaMap.get(pendingFieldId);
    if (!meta) return;

    const needValue = pendingOperator !== 'empty' && pendingOperator !== 'notEmpty';
    if (
      needValue &&
      (pendingValue === null || pendingValue === '' || pendingValue === undefined)
    ) {
      Toast.warning('请选择或输入筛选值');
      return;
    }

    const opLabel = getOperators(meta).find((o) => o.value === pendingOperator)?.label ?? '';
    let valueLabel = '';
    if (needValue) {
      if (meta.type === FieldType.Checkbox) valueLabel = pendingValue ? '是' : '否';
      else valueLabel = String(pendingValue);
    }
    const label = `${meta.name} ${opLabel} ${valueLabel}`.trim();

    setFilters((prev) => [
      ...prev,
      {
        fieldId: pendingFieldId,
        operator: pendingOperator,
        value: pendingValue,
        label,
      },
    ]);
    setFilterVisible(false);
    setPendingFieldId('');
    setPendingOperator('');
    setPendingValue(null);
  };

  const removeFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFilters = () => setFilters([]);

  const renderValueInput = () => {
    if (!pendingFieldId || !fieldMetaMap) return null;
    if (pendingOperator === 'empty' || pendingOperator === 'notEmpty') return null;

    const meta = fieldMetaMap.get(pendingFieldId);
    if (!meta) return null;

    switch (meta.type) {
      case FieldType.Text:
      case FieldType.Url:
        return (
          <Input
            placeholder="输入关键词"
            value={pendingValue ?? ''}
            onChange={(v) => setPendingValue(v)}
          />
        );
      case FieldType.Number:
        return (
          <Input
            type="number"
            placeholder="输入数字"
            value={pendingValue ?? ''}
            onChange={(v) => setPendingValue(v)}
          />
        );
      case FieldType.SingleSelect:
      case FieldType.MultiSelect: {
        const options = (meta as ISelectFieldMeta).property?.options ?? [];
        return (
          <Select
            placeholder="选择选项"
            value={pendingValue ?? undefined}
            onChange={(v) => setPendingValue(v)}
            style={{ width: '100%' }}
          >
            {options.map((o) => (
              <Select.Option key={o.id} value={o.name}>
                {o.name}
              </Select.Option>
            ))}
          </Select>
        );
      }
      case FieldType.Checkbox:
        return (
          <Select
            placeholder="选择"
            value={pendingValue ?? undefined}
            onChange={(v) => setPendingValue(v)}
            style={{ width: '100%' }}
          >
            <Select.Option value={true}>是</Select.Option>
            <Select.Option value={false}>否</Select.Option>
          </Select>
        );
      default:
        return (
          <Input
            placeholder="输入筛选值"
            value={pendingValue ?? ''}
            onChange={(v) => setPendingValue(v)}
          />
        );
    }
  };

  const filterPanel = (
    <div style={{ width: 320, padding: 4 }}>
      <div style={{ marginBottom: 12 }}>
        <Text strong size="small">选择字段</Text>
        <Select
          placeholder="请选择字段"
          value={pendingFieldId || undefined}
          onChange={(v) => setPendingFieldId(String(v))}
          style={{ width: '100%', marginTop: 6 }}
        >
          {columns.map((col: any) => (
            <Select.Option key={col.dataIndex} value={col.dataIndex}>
              {col.title}
            </Select.Option>
          ))}
        </Select>
      </div>

      {pendingFieldId && (
        <div style={{ marginBottom: 12 }}>
          <Text strong size="small">条件</Text>
          <Select
            value={pendingOperator || undefined}
            onChange={(v) => setPendingOperator(String(v))}
            style={{ width: '100%', marginTop: 6 }}
          >
            {fieldMetaMap &&
              getOperators(fieldMetaMap.get(pendingFieldId)!).map((op) => (
                <Select.Option key={op.value} value={op.value}>
                  {op.label}
                </Select.Option>
              ))}
          </Select>
        </div>
      )}

      {pendingFieldId && renderValueInput() && (
        <div style={{ marginBottom: 12 }}>
          <Text strong size="small">筛选值</Text>
          <div style={{ marginTop: 6 }}>{renderValueInput()}</div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button size="small" onClick={() => setFilterVisible(false)}>
          取消
        </Button>
        <Button
          size="small"
          theme="solid"
          type="primary"
          disabled={!pendingFieldId || !pendingOperator}
          onClick={handleAddFilter}
        >
          添加
        </Button>
      </div>
    </div>
  );

  /* ---------------- 列定义 ---------------- */

  const mergedColumns = useMemo(() => {
    const nonAttachmentColumns: any[] = [];
    const attachmentColumns: any[] = [];

    columns.forEach((col: any) => {
      const meta = fieldMetaMap?.get(col.dataIndex);
      if (meta?.type === FieldType.Attachment) {
        attachmentColumns.push({
          ...col,
          fixed: 'right' as const,
          width: 200,
          ellipsis: false,
        });
      } else {
        nonAttachmentColumns.push({
          ...col,
          width: col.width ?? getColumnWidth(meta),
          ellipsis: { showTitle: true },
        });
      }
    });

    return [
      ...nonAttachmentColumns,
      ...attachmentColumns,
      {
        title: '操作',
        dataIndex: '_operation',
        width: 100,
        fixed: 'right' as const,
        ellipsis: false,
        render: (_: any, record: Record<string, any>) => (
          <Button
            size="small"
            theme="solid"
            type="primary"
            onClick={() => handleExportRow(record)}
          >
            导出图片
          </Button>
        ),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, fieldMetaMap]);

  // 表格总宽度：所有列宽之和
  const totalWidth = useMemo(() => {
    return mergedColumns.reduce(
      (sum: number, col: any) => sum + (Number(col.width) || DEFAULT_COL_WIDTH),
      0
    );
  }, [mergedColumns]);

  if (!hasResult) return <></>;

  const collectImageUrls = async (recordIds: string[]): Promise<string[]> => {
    if (!table || !fieldMetaMap) return [];

    const attachmentFieldIds: string[] = [];
    (fieldMetaMap as Map<string, IFieldMeta>).forEach((meta, id) => {
      if (meta.type === FieldType.Attachment) {
        attachmentFieldIds.push(id);
      }
    });

    if (!attachmentFieldIds.length) return [];

    const allUrls: string[] = [];
    for (const recordId of recordIds) {
      for (const fieldId of attachmentFieldIds) {
        const cellValue = await table.getCellValue(fieldId, recordId);
        const attachments = Array.isArray(cellValue) ? cellValue : [];
        for (const att of attachments) {
          const token = (att as any)?.token;
          if (!token) continue;
          try {
            const url = await (table as any).getAttachmentUrl(token);
            if (url) allUrls.push(url);
          } catch (e) {
            console.error('获取附件 URL 失败:', e);
          }
        }
      }
    }
    return allUrls;
  };

  const handleExportAll = async () => {
    if (!filteredData?.length) {
      Toast.warning('当前没有数据');
      return;
    }

    setExporting(true);
    Toast.info('正在收集图片...');

    try {
      const recordIds = filteredData
        .map((r: any) => r.recordId)
        .filter(Boolean) as string[];

      const urls = await collectImageUrls(recordIds);

      if (!urls.length) {
        Toast.warning('当前表格没有可导出的图片');
        return;
      }

      await downloadImages(urls, '图片');
      Toast.success(`已导出 ${urls.length} 张图片`);
    } catch (e) {
      console.error('导出失败:', e);
      Toast.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleExportRow = async (record: Record<string, any>) => {
    const recordId = record.recordId;
    if (!recordId) return;

    Toast.info('正在收集图片...');
    const urls = await collectImageUrls([recordId]);

    if (!urls.length) {
      Toast.warning('该行没有可导出的图片');
      return;
    }

    await downloadImages(urls, `图片_${recordId.slice(-4)}`);
    Toast.success(`已导出 ${urls.length} 张图片`);
  };

  const hasFilters = filters.length > 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.greetingWrapper}>
          <Title heading={4} style={styles.greetingText}>
            尊敬的客户，{greeting}
          </Title>
          <Text type="tertiary" size="small" style={styles.subText}>
            欢迎使用数据视图，以下是为您准备的最新数据
          </Text>
        </div>

        <Divider margin="10px" align="center" style={styles.divider}>
          <span style={styles.dividerText}>数据明细</span>
        </Divider>

        <div style={styles.toolbar}>
          <div style={styles.toolbarLeft}>
            <Text size="small" type="tertiary">
              共{' '}
              <strong style={{ color: '#1c1f23' }}>
                {filteredData.length}
              </strong>
              {hasFilters && ` / ${dataSource.length}`} 条数据
            </Text>

            {/* 用原生 span 作为 Popover 触发器，避免 Semi Button + Tooltip 的 findDOMNode 警告 */}
            <Popover
              visible={filterVisible}
              onVisibleChange={setFilterVisible}
              trigger="click"
              content={filterPanel}
              position="bottomLeft"
            >
              <span className="yyjk-filter-trigger">+ 筛选条件</span>
            </Popover>

            {hasFilters && (
              <Button size="small" theme="borderless" onClick={clearFilters}>
                清空筛选
              </Button>
            )}
          </div>

          <Space>
            <Button
              theme="solid"
              type="primary"
              loading={exporting}
              onClick={handleExportAll}
            >
              一键导出全部图片
            </Button>
          </Space>
        </div>

        {hasFilters && (
          <div style={styles.filterTags}>
            {filters.map((f, i) => (
              <Tag
                key={`${f.fieldId}-${i}`}
                closable
                onClose={() => removeFilter(i)}
                color="blue"
                size="small"
                style={{ marginRight: 6, marginBottom: 4 }}
              >
                {f.label}
              </Tag>
            ))}
          </div>
        )}
      </div>

      <div ref={tableWrapperRef} style={styles.tableWrapper}>
        <Table
          columns={mergedColumns}
          dataSource={filteredData}
          rowKey="recordId"
          pagination={false}
          size="small"
          bordered
          tableLayout="fixed"
          scroll={{ x: totalWidth + 2, y: tableBodyHeight }}
          empty="暂无数据"
        />
      </div>

      {showFakeScroll && (
        <div
          ref={fakeScrollRef}
          onScroll={handleFakeScroll}
          className="yyjk-fake-scrollbar"
          style={styles.fakeScrollBar}
          title="横向滚动"
        >
          <div style={{ width: fakeScrollWidth, height: 8 }} />
        </div>
      )}
    </div>
  );
};

/* ---------------- 样式定义 ---------------- */

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 20px 0',
    background: '#fafbfc',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  header: { flexShrink: 0, paddingBottom: 8 },
  greetingWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px',
    padding: '4px 0',
  },
  greetingText: {
    margin: 0,
    background: 'linear-gradient(90deg, #1c1f23 0%, #4e5969 60%, #8c8c8c 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontWeight: 600,
    letterSpacing: '0.5px',
  },
  subText: { color: '#8c8c8c', letterSpacing: '0.2px' },
  divider: { margin: '10px 0' },
  dividerText: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#8c8c8c',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e8eaed',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  },
  toolbarLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  filterTags: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
    padding: '6px 12px',
    background: '#f5f7fa',
    borderRadius: 6,
    border: '1px dashed #d9dde3',
  },
  tableWrapper: {
    flex: 1,
    minHeight: 0,
    borderRadius: '8px 8px 0 0',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
    background: '#fff',
    marginBottom: 8,
  },
  fakeScrollBar: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    height: 8,
    overflowX: 'auto',
    overflowY: 'hidden',
    background: '#e8eaed',
    borderTop: '1px solid #d9dde3',
    zIndex: 100,
    margin: 0,
    padding: 0,
    lineHeight: 0,
    fontSize: 0,
  },
};