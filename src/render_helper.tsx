import React from 'react';
import {
  AvatarGroup,
  Avatar,
  Typography,
  Checkbox,
  Select,
  DatePicker,
  Image,
} from '@douyinfe/semi-ui';
import {
  FieldType,
  IOpenAttachment,
  ISelectFieldMeta,
  IOpenSegment,
  IOpenUser,
  IOpenSegmentType,
  IOpenMultiSelect,
  IWidgetTable,
  IFieldMeta,
  IOpenSingleSelect,
  ISelectFieldOption,
} from '@lark-opdev/block-bitable-api';

const { Text } = Typography;

const colors = [
  'amber', 'blue', 'cyan', 'green', 'grey', 'indigo',
  'light-blue', 'light-green', 'lime', 'orange', 'pink',
  'purple', 'red', 'teal', 'violet', 'yellow',
];

interface IRenderFuncContext {
  table: IWidgetTable;
  meta: IFieldMeta;
}

function colorHelper(name?: string) {
  return colors[(name?.codePointAt(0) || 0) % colors.length];
}

function renderSegment(context: IRenderFuncContext) {
  return (segs: IOpenSegment[]) => {
    return (
      <>
        {(segs || []).map((seg, index) => (
          <Text
            key={`${seg.text}-${index}`}
            link={
              seg.type === IOpenSegmentType.Url
                ? { href: seg.link, target: '_blank' }
                : void 0
            }
          >
            {seg.text}
          </Text>
        ))}
      </>
    );
  };
}

function renderUser(context: IRenderFuncContext) {
  return (users: IOpenUser[]) => {
    return (
      <AvatarGroup size="small">
        {(users || []).map((user) => (
          <Avatar alt={user.name} color={colorHelper(user.name) as any}>
            {user.name}
          </Avatar>
        ))}
      </AvatarGroup>
    );
  };
}

function renderCheckBox(context: IRenderFuncContext) {
  return (checked: boolean, record: { recordId: string }) => {
    return (
      <Checkbox
        defaultChecked={!!checked}
        onChange={(checked) => {
          if (!record || !record.recordId) return;
          context.table.setCellValue(
            context.meta.id,
            record.recordId,
            !!checked.target.checked
          );
        }}
      ></Checkbox>
    );
  };
}

function renderOption(context: IRenderFuncContext) {
  const { table, meta } = context;
  const {
    id,
    type,
    property: { options },
  } = meta as ISelectFieldMeta;
  const optionMap = new Map<string, ISelectFieldOption>();
  options.forEach((option) => optionMap.set(option.id, option));

  return (
    option: IOpenMultiSelect | IOpenSingleSelect,
    record: { recordId: string }
  ) => {
    const multiple = FieldType.MultiSelect === type;
    option = option
      ? ((Array.isArray(option) ? option : [option]) as IOpenMultiSelect)
      : [];

    return (
      <Select
        style={{ width: '150px' }}
        multiple={multiple}
        defaultValue={option.map((op) => (multiple ? op.id : op.text))}
        onChange={(value) => {
          value = Array.isArray(value) ? value : [value];
          const cellValues = (value as string[])
            .map((id) => optionMap.get(id)!)
            .map((option) => ({
              id: option.id,
              text: option.name,
            }));

          table.setCellValue<IOpenSingleSelect | IOpenMultiSelect>(
            id,
            record.recordId,
            multiple ? cellValues : cellValues[0]
          );
        }}
      >
        {options.map((option) => (
          <Select.Option value={option.id} key={option.id}>
            {option.name}
          </Select.Option>
        ))}
      </Select>
    );
  };
}

function renderDate(context: IRenderFuncContext) {
  return (time: number, record: { recordId: string }) => {
    return (
      <DatePicker
        defaultValue={time}
        disabled={context.meta.type !== FieldType.DateTime}
        onChange={(date) => {
          const dateString = date?.toLocaleString() || '';
          if (!dateString) return;
          const time = new Date(dateString).getTime();
          context.table.setCellValue(context.meta.id, record.recordId, time);
        }}
      />
    );
  };
}

/* ---------------- 附件字段渲染 ---------------- */

const AttachmentPreview: React.FC<{
  table: IWidgetTable;
  attachments: IOpenAttachment[];
}> = ({ table, attachments }) => {
  const [urls, setUrls] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await Promise.all(
          attachments.map(async (att) => {
            try {
              return await (table as any).getAttachmentUrl(att.token);
            } catch {
              return null;
            }
          })
        );
        if (!cancelled) {
          setUrls(list.filter(Boolean) as string[]);
          setLoading(false);
        }
      } catch (e) {
        console.error('获取附件 URL 失败:', e);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [table, attachments]);

  if (loading) {
    return <span style={{ color: '#ccc', fontSize: 12 }}>加载中...</span>;
  }
  if (!urls.length) {
    return <span style={{ color: '#ccc' }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {urls.map((url, i) => (
        <Image
          key={i}
          src={url}
          width={36}
          height={36}
          style={{ objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
          preview={{ src: url }}
        />
      ))}
    </div>
  );
};

function renderAttachment(context: IRenderFuncContext) {
  const { table } = context;
  return (attachments: IOpenAttachment[]) => {
    if (!attachments?.length) {
      return <span style={{ color: '#ccc' }}>—</span>;
    }
    return <AttachmentPreview table={table} attachments={attachments} />;
  };
}

/* ---------------- 渲染映射 ---------------- */

const RenderFuncMap: Partial<
  Record<
    FieldType,
    (context: IRenderFuncContext) => (...args: any[]) => React.ReactNode
  >
> = {
  [FieldType.User]: renderUser,
  [FieldType.CreatedUser]: renderUser,
  [FieldType.ModifiedUser]: renderUser,
  [FieldType.Text]: renderSegment,
  [FieldType.Url]: renderSegment,
  [FieldType.Checkbox]: renderCheckBox,
  [FieldType.SingleSelect]: renderOption,
  [FieldType.MultiSelect]: renderOption,
  [FieldType.DateTime]: renderDate,
  [FieldType.CreatedTime]: renderDate,
  [FieldType.ModifiedTime]: renderDate,
  [FieldType.Attachment]: renderAttachment,
};

const renderDefault =
  () =>
  (...args: unknown[]) =>
    <>{args[0]}</>;

export function getRenderFunc(context: IRenderFuncContext) {
  const { meta } = context;
  const render = RenderFuncMap[meta.type] || renderDefault;
  return render(context) as (...args: any[]) => React.ReactNode;
}