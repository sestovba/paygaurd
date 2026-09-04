"use client";

import { Table } from "antd";
import type { TableProps } from "antd";

export type LedgerTableProps<RecordType extends object> =
  TableProps<RecordType> & {
    density?: "compact" | "comfortable";
  };

export function LedgerTable<RecordType extends object>({
  density = "comfortable",
  pagination,
  locale,
  ...props
}: LedgerTableProps<RecordType>) {
  const resolvedPagination =
    pagination === false
      ? false
      : {
          defaultPageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: [10, 25, 50],
          showTotal: (total: number) =>
            `${total} ${total === 1 ? "record" : "records"}`,
          ...(typeof pagination === "object"
            ? pagination
            : {}),
        };

  return (
    <div
      className="pg-ledger-table"
      data-density={density}
    >
      <Table<RecordType>
        {...props}
        pagination={resolvedPagination}
        locale={{
          emptyText: (
            <div className="pg-table-empty">
              <strong>No records found</strong>
              <span>
                Try changing your search or filters.
              </span>
            </div>
          ),
          ...locale,
        }}
      />
    </div>
  );
}
