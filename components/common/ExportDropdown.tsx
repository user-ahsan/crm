'use client';

import { IconDownload, IconLoader } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface EntityTypeOption {
  key: string;
  label: string;
}

interface ExportDropdownProps {
  /** List of entity types available for export */
  entityTypes: EntityTypeOption[];
  /** Called when user selects an entity type to export */
  onExport: (entityType: string) => void;
  /** Whether an export operation is in progress */
  isExporting?: boolean;
}

export function ExportDropdown({
  entityTypes,
  onExport,
  isExporting = false,
}: ExportDropdownProps) {
  const hasItems = entityTypes.length > 0;
  const disabled = !hasItems || isExporting;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" disabled={disabled}>
            {isExporting ? (
              <IconLoader className="size-4 animate-spin" />
            ) : (
              <IconDownload className="size-4" />
            )}
            Export
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Export as CSV</DropdownMenuLabel>

        {entityTypes.map((type) => (
          <DropdownMenuItem
            key={type.key}
            onClick={() => onExport(type.key)}
            disabled={isExporting}
          >
            {type.label}
          </DropdownMenuItem>
        ))}

        {hasItems && <DropdownMenuSeparator />}

        <DropdownMenuItem
          onClick={() => onExport('all')}
          disabled={isExporting || !hasItems}
        >
          Export All
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ExportDropdown;
