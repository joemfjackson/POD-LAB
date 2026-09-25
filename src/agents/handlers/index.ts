import type { AgentKey } from "@/domain/lifecycle";
import type { AnyAgentHandler } from "../runtime/types";
import { brandArchitectHandler } from "./brand-architect";
import { creativeDirectorHandler } from "./creative-director";
import { directorHandler } from "./director";
import { experimentAnalystHandler } from "./experiment-analyst";
import { growthHandler } from "./growth";
import { ipComplianceHandler } from "./ip-compliance";
import { opportunityScoutHandler } from "./opportunity-scout";
import { productProfitHandler } from "./product-profit";
import { storeBuilderHandler } from "./store-builder";
import { trendWatcherHandler } from "./trend-watcher";

export const HANDLERS: Record<AgentKey, AnyAgentHandler> = {
  director: directorHandler,
  opportunity_scout: opportunityScoutHandler,
  brand_architect: brandArchitectHandler,
  creative_director: creativeDirectorHandler,
  ip_compliance: ipComplianceHandler,
  product_profit: productProfitHandler,
  store_builder: storeBuilderHandler,
  growth: growthHandler,
  trend_watcher: trendWatcherHandler,
  experiment_analyst: experimentAnalystHandler,
};
