import type { Deal, DealStage } from '@/types/deal.types';

export interface DealPipelineStage {
  stage: DealStage;
  deals: Deal[];
  totalValue: number;
  count: number;
}

export function buildDealPipeline(stages: DealStage[], deals: Deal[]): DealPipelineStage[] {
  return stages.map((stage) => {
    const stageDeals = deals.filter((d) => d.stageId === stage.id);
    return {
      stage,
      deals: stageDeals,
      totalValue: stageDeals.reduce((sum, d) => sum + d.value, 0),
      count: stageDeals.length,
    };
  });
}
