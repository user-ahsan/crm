'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { IconSearch, IconArrowsLeftRight, IconShieldCheck } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { leadService } from '@/services/lead.service';
import { contactService } from '@/services/contact.service';
import { companyService } from '@/services/company.service';
import type { Lead } from '@/types/lead.types';
import type { Contact } from '@/types/contact.types';
import type { Company } from '@/types/company.types';

type TabType = 'leads' | 'contacts' | 'companies';

interface LeadGroup {
  lead: Lead;
  duplicates: Lead[];
  score: number;
}

interface ContactGroup {
  contact: Contact;
  duplicates: Contact[];
  score: number;
}

interface CompanyGroup {
  company: Company;
  duplicates: Company[];
  score: number;
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200';
  if (score >= 40) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200';
}

function getMatchReason(a: Lead | Contact | Company, b: Lead | Contact | Company): string[] {
  const reasons: string[] = [];
  if ('email' in a && 'email' in b && a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) {
    reasons.push('Email');
  }
  if ('phone' in a && 'phone' in b && a.phone && b.phone) {
    const pa = a.phone.replace(/\D/g, '').slice(-10);
    const pb = b.phone.replace(/\D/g, '').slice(-10);
    if (pa === pb && pa.length >= 10) reasons.push('Phone');
  }
  if ('fullName' in a && 'fullName' in b && a.fullName && b.fullName) {
    reasons.push('Name');
  }
  if ('name' in a && 'name' in b && a.name && b.name) {
    if (a.name.toLowerCase() === b.name.toLowerCase()) {
      reasons.push('Name');
    }
  }
  if ('companyName' in a && 'companyName' in b && a.companyName && b.companyName && a.companyName.toLowerCase() === b.companyName.toLowerCase()) {
    reasons.push('Company');
  }
  if ('website' in a && 'website' in b && a.website && b.website) {
    reasons.push('Website');
  }
  if ('industry' in a && 'industry' in b && a.industry && b.industry && a.industry.toLowerCase() === b.industry.toLowerCase()) {
    reasons.push('Industry');
  }
  return reasons;
}

export default function DataQualityPage() {
  const [activeTab, setActiveTab] = useState<TabType>('leads');
  const [scanning, setScanning] = useState(false);
  const [merging, setMerging] = useState(false);
  const [leadGroups, setLeadGroups] = useState<LeadGroup[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [companyGroups, setCompanyGroups] = useState<CompanyGroup[]>([]);
  const [survivorIds, setSurvivorIds] = useState<Record<string, string>>({});
  const [scanError, setScanError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    try {
      if (activeTab === 'leads') {
        const result = await leadService.findDuplicates();
        setLeadGroups(result);
        const survivors: Record<string, string> = {};
        for (const g of result) {
          survivors[g.lead.id] = g.lead.id;
        }
        setSurvivorIds(survivors);
      } else if (activeTab === 'contacts') {
        const result = await contactService.findDuplicates();
        setContactGroups(result);
        const survivors: Record<string, string> = {};
        for (const g of result) {
          survivors[g.contact.id] = g.contact.id;
        }
        setSurvivorIds(survivors);
      } else {
        const result = await companyService.findDuplicates();
        setCompanyGroups(result);
        const survivors: Record<string, string> = {};
        for (const g of result) {
          survivors[g.company.id] = g.company.id;
        }
        setSurvivorIds(survivors);
      }
    } catch {
      setScanError('Failed to scan for duplicates');
    } finally {
      setScanning(false);
    }
  }, [activeTab]);

  const handleMerge = useCallback(async (groupId: string) => {
    setMerging(true);
    try {
      if (activeTab === 'leads') {
        const group = leadGroups.find((g) => g.lead.id === groupId);
        if (!group) return;
        const survivorId = survivorIds[groupId] || group.lead.id;
        const mergeIds = [group.lead, ...group.duplicates]
          .filter((e) => e.id !== survivorId)
          .map((e) => e.id);
        if (mergeIds.length === 0) {
          toast.info('No duplicates to merge');
          return;
        }
        await leadService.mergeLeads(survivorId, mergeIds);
        setLeadGroups((prev) => prev.filter((g) => g.lead.id !== groupId));
        toast.success('Duplicates merged successfully');
      } else if (activeTab === 'contacts') {
        const group = contactGroups.find((g) => g.contact.id === groupId);
        if (!group) return;
        const survivorId = survivorIds[groupId] || group.contact.id;
        const mergeIds = [group.contact, ...group.duplicates]
          .filter((e) => e.id !== survivorId)
          .map((e) => e.id);
        if (mergeIds.length === 0) {
          toast.info('No duplicates to merge');
          return;
        }
        await contactService.merge(survivorId, mergeIds);
        setContactGroups((prev) => prev.filter((g) => g.contact.id !== groupId));
        toast.success('Duplicates merged successfully');
      } else {
        const group = companyGroups.find((g) => g.company.id === groupId);
        if (!group) return;
        const survivorId = survivorIds[groupId] || group.company.id;
        const mergeIds = [group.company, ...group.duplicates]
          .filter((e) => e.id !== survivorId)
          .map((e) => e.id);
        if (mergeIds.length === 0) {
          toast.info('No duplicates to merge');
          return;
        }
        await companyService.merge(survivorId, mergeIds);
        setCompanyGroups((prev) => prev.filter((g) => g.company.id !== groupId));
        toast.success('Duplicates merged successfully');
      }
    } catch {
      toast.error('Failed to merge duplicates');
    } finally {
      setMerging(false);
    }
  }, [activeTab, leadGroups, contactGroups, companyGroups, survivorIds]);

  const handleSetSurvivor = useCallback((groupId: string, entityId: string) => {
    setSurvivorIds((prev) => ({ ...prev, [groupId]: entityId }));
  }, []);

  const currentGroups = activeTab === 'leads' ? leadGroups : activeTab === 'contacts' ? contactGroups : companyGroups;

  const renderGroup = (group: LeadGroup | ContactGroup | CompanyGroup) => {
    const groupId = 'lead' in group ? group.lead.id : 'contact' in group ? group.contact.id : group.company.id;
    const primary = 'lead' in group ? group.lead : 'contact' in group ? group.contact : group.company;
    const duplicates = 'lead' in group ? group.duplicates : 'contact' in group ? group.duplicates : (group as CompanyGroup).duplicates;
    const allEntities = [primary, ...duplicates];
    const selectedSurvivorId = survivorIds[groupId] || primary.id;

    return (
      <Card key={groupId} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">
                Duplicate Group
              </CardTitle>
              <Badge className={getScoreColor(group.score)}>
                {group.score}% match
              </Badge>
            </div>
            <Button
              size="sm"
              onClick={() => handleMerge(groupId)}
              disabled={merging}
            >
              <IconArrowsLeftRight className="mr-1 size-4" />
              Merge Selected
            </Button>
          </div>
          {duplicates.length > 0 && (
            <CardDescription>
              {getMatchReason(primary, duplicates[0]).join(', ')} match
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Survivor</TableHead>
                <TableHead>Name</TableHead>
                {'email' in primary && <TableHead>Email</TableHead>}
                {'phone' in primary && <TableHead>Phone</TableHead>}
                {'companyName' in primary && <TableHead>Company</TableHead>}
                {'name' in primary && 'industry' in primary && <TableHead>Industry</TableHead>}
                {'website' in primary && <TableHead>Website</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {allEntities.map((entity) => {
                const eid = 'id' in entity ? entity.id : '';
                const isSurvivor = eid === selectedSurvivorId;
                return (
                  <TableRow key={eid} className={isSurvivor ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <input
                        type="radio"
                        name={`survivor-${groupId}`}
                        checked={isSurvivor}
                        onChange={() => handleSetSurvivor(groupId, eid)}
                        className="size-4 accent-primary"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {'fullName' in entity ? entity.fullName : 'name' in entity ? entity.name : ''}
                      {isSurvivor && (
                        <Badge variant="outline" className="ml-2 text-xs">Survivor</Badge>
                      )}
                    </TableCell>
                    {'email' in entity && (
                      <TableCell className="text-muted-foreground">{entity.email || '—'}</TableCell>
                    )}
                    {'phone' in entity && (
                      <TableCell className="text-muted-foreground">{entity.phone || '—'}</TableCell>
                    )}
                    {'companyName' in entity && (
                      <TableCell className="text-muted-foreground">{entity.companyName || '—'}</TableCell>
                    )}
                    {'name' in entity && 'industry' in entity && (
                      <TableCell className="text-muted-foreground">{entity.industry || '—'}</TableCell>
                    )}
                    {'website' in entity && (
                      <TableCell className="text-muted-foreground">{entity.website || '—'}</TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Quality"
        description="Find and merge duplicate records across your CRM"
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="companies">Companies</TabsTrigger>
          </TabsList>

          <Button onClick={handleScan} disabled={scanning}>
            <IconSearch className="mr-1 size-4" />
            {scanning ? 'Scanning...' : 'Scan for Duplicates'}
          </Button>
        </div>

        <TabsContent value="leads" className="mt-4">
          {scanError && <ErrorState message={scanError} onRetry={handleScan} />}

          {scanning && !scanError && (
            <LoadingSkeleton type="table" count={3} />
          )}

          {!scanning && !scanError && leadGroups.length === 0 && (
            <EmptyState
              title="No duplicate leads found"
              description="Click 'Scan for Duplicates' to check for duplicate records."
              icon={<IconShieldCheck className="size-12 text-muted-foreground" />}
            />
          )}

          {leadGroups.map(renderGroup)}
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          {scanError && <ErrorState message={scanError} onRetry={handleScan} />}

          {scanning && !scanError && (
            <LoadingSkeleton type="table" count={3} />
          )}

          {!scanning && !scanError && contactGroups.length === 0 && (
            <EmptyState
              title="No duplicate contacts found"
              description="Click 'Scan for Duplicates' to check for duplicate records."
              icon={<IconShieldCheck className="size-12 text-muted-foreground" />}
            />
          )}

          {contactGroups.map(renderGroup)}
        </TabsContent>

        <TabsContent value="companies" className="mt-4">
          {scanError && <ErrorState message={scanError} onRetry={handleScan} />}

          {scanning && !scanError && (
            <LoadingSkeleton type="table" count={3} />
          )}

          {!scanning && !scanError && companyGroups.length === 0 && (
            <EmptyState
              title="No duplicate companies found"
              description="Click 'Scan for Duplicates' to check for duplicate records."
              icon={<IconShieldCheck className="size-12 text-muted-foreground" />}
            />
          )}

          {companyGroups.map(renderGroup)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
