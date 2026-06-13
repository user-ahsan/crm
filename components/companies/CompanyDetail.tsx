'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Company } from '@/types/company.types';
import type { Contact } from '@/types/contact.types';
import type { Lead } from '@/types/lead.types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { companyService } from '@/services/company.service';
import { contactService } from '@/services/contact.service';
import { leadService } from '@/services/lead.service';
import { formatDate, formatCurrency, getInitials } from '@/lib/formatters';
import {
  IconArrowLeft,
  IconBuilding,
  IconUsers,
  IconTrendingUp,
  IconMapPin,
  IconGlobe,
  IconBriefcase,
  IconAlertCircle,
  IconLoader2,
} from '@tabler/icons-react';

interface CompanyDetailProps {
  companyId: string;
  onBack?: () => void;
}

type ActiveTab = 'overview' | 'contacts' | 'leads';

export function CompanyDetail({ companyId, onBack }: CompanyDetailProps) {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [linkedContacts, setLinkedContacts] = useState<Contact[]>([]);
  const [linkedLeads, setLinkedLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const found = await companyService.getById(companyId);
      if (!found) {
        setError('Company not found');
        setLoading(false);
        return;
      }
      setCompany(found);

      const [contactResults, leadResults] = await Promise.all([
        Promise.all(found.contactIds.map((contactId) => contactService.getById(contactId))),
        Promise.all(found.leadIds.map((leadId) => leadService.getById(leadId))),
      ]);
      setLinkedContacts(contactResults.filter((c): c is Contact => c !== undefined));
      setLinkedLeads(leadResults.filter((l): l is Lead => l !== undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load company details');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      router.push('/companies');
    }
  }, [onBack, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Loading company details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 text-destructive">
          <IconAlertCircle size={48} stroke={1.5} />
        </div>
        <h3 className="mb-1 text-lg font-semibold">Failed to load company</h3>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={loadData}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 text-muted-foreground">
          <IconBuilding size={48} stroke={1.5} />
        </div>
        <h3 className="mb-1 text-lg font-semibold">Company not found</h3>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          The company you are looking for does not exist or has been deleted.
        </p>
        <Button variant="outline" onClick={handleBack}>
          Back to Companies
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={handleBack} aria-label="Go back">
          <IconArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{company.name}</h1>
          <p className="text-sm text-muted-foreground">
            Created {formatDate(company.createdAt)}
          </p>
        </div>
      </div>

      <Separator />

      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Avatar size="lg">
              <AvatarFallback className="text-lg">{getInitials(company.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div>
                <h2 className="text-lg font-semibold">{company.name}</h2>
                {company.industry && (
                  <Badge variant="secondary" className="mt-1 text-xs font-normal">
                    {company.industry}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 sm:justify-start">
                {company.industry && (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <IconBriefcase className="size-4" />
                    {company.industry}
                  </span>
                )}
                {company.size && (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <IconUsers className="size-4" />
                    {company.size} employees
                  </span>
                )}
                {company.location && (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <IconMapPin className="size-4" />
                    {company.location}
                  </span>
                )}
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <IconGlobe className="size-4" />
                    Website
                  </a>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 sm:justify-start">
                <span className="inline-flex items-center gap-1 text-sm">
                  <IconTrendingUp className="size-4 text-muted-foreground" />
                  <span className="font-semibold tabular-nums">
                    {company.revenue > 0 ? formatCurrency(company.revenue) : '—'}
                  </span>
                  <span className="text-muted-foreground">/yr revenue</span>
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value: string) => setActiveTab(value as ActiveTab)}
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts
            {linkedContacts.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs tabular-nums">
                {linkedContacts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="leads">
            Leads
            {linkedLeads.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs tabular-nums">
                {linkedLeads.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Industry</span>
                  <span>{company.industry || '—'}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size</span>
                  <span>{company.size ? `${company.size} employees` : '—'}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-medium tabular-nums">
                    {company.revenue > 0 ? formatCurrency(company.revenue) : '—'}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span>{company.location || '—'}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Website</span>
                  {company.website ? (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate max-w-[200px]"
                    >
                      {company.website}
                    </a>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Linked Contacts</span>
                  <span className="font-medium tabular-nums">{linkedContacts.length}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Linked Leads</span>
                  <span className="font-medium tabular-nums">{linkedLeads.length}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="tabular-nums">{formatDate(company.createdAt)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span className="tabular-nums">{formatDate(company.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          {linkedContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <IconUsers className="mb-3 size-8 text-muted-foreground" />
              <h3 className="mb-1 text-base font-medium">No contacts</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                No contacts are linked to this company.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {linkedContacts.map((contact) => (
                <Card
                  key={contact.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/contacts/${contact.id}`)}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{contact.name}</p>
                        {contact.jobTitle && (
                          <p className="text-sm text-muted-foreground">{contact.jobTitle}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {contact.email && (
                        <p className="text-sm text-muted-foreground">{contact.email}</p>
                      )}
                      {contact.tags.length > 0 && (
                        <div className="mt-1 flex justify-end gap-1">
                          {contact.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs font-normal">
                              {tag}
                            </Badge>
                          ))}
                          {contact.tags.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{contact.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Leads Tab */}
        <TabsContent value="leads">
          {linkedLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <IconTrendingUp className="mb-3 size-8 text-muted-foreground" />
              <h3 className="mb-1 text-base font-medium">No leads</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                No leads are linked to this company.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {linkedLeads.map((lead) => (
                <Card
                  key={lead.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/leads/${lead.id}`)}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">{lead.fullName}</p>
                      <p className="text-sm text-muted-foreground">
                        {lead.email || '—'} {lead.industry ? `· ${lead.industry}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs font-normal">
                        {lead.status}
                      </Badge>
                      {lead.estimatedValue > 0 && (
                        <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                          {formatCurrency(lead.estimatedValue)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CompanyDetail;
