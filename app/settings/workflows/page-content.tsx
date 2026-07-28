'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { WorkflowEditor } from '@/components/workflow/WorkflowEditor';
import type { WorkflowEntityType } from '@/types/workflow.types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const ENTITY_TABS: { value: WorkflowEntityType; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'deal', label: 'Deal' },
  { value: 'task', label: 'Task' },
];

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState<WorkflowEntityType>('lead');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow Builder"
        description="Create and manage custom workflows for leads, deals, and tasks. Drag to reorder states, click to connect them with transitions."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as WorkflowEntityType)}>
        <TabsList>
          {ENTITY_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {ENTITY_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <WorkflowEditor entityType={tab.value} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
