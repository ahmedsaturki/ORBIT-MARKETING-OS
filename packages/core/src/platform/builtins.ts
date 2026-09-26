import type {
  ConnectorExtensionManifest,
  PlatformExtensionManifest,
  VerticalPackManifest,
} from "./index.js";

const connectorCapability = (
  id: string,
  title: string,
  description: string,
  risk: "low" | "medium" | "high" | "critical",
  externallyVisible: boolean,
  scope: string,
) => ({
  id,
  title,
  description,
  risk,
  externallyVisible,
  requiredScopes: [scope],
});

function vertical(
  id: string,
  name: string,
  verticalId: string,
  stages: readonly string[],
  objectTypes: readonly string[],
  workflows: readonly string[],
): VerticalPackManifest {
  return {
    id,
    version: "1.0.0",
    name,
    vendor: "ORBIT",
    kind: "vertical_pack",
    vertical: verticalId,
    defaultPolicyPack: "balanced",
    lifecycleStages: stages,
    objectTypes,
    workflowIds: workflows,
    capabilities: [
      {
        id: id + ".templates",
        title: name + " operating templates",
        description:
          "Structured workflows and lifecycle vocabulary for " +
          name.toLowerCase() +
          ".",
        risk: "low",
        externallyVisible: false,
        requiredScopes: ["vertical:read"],
      },
    ],
    requiredPermissions: ["vertical:read"],
    minOrbitVersion: "0.2.0",
    enabledByDefault: false,
  };
}

export const BUILT_IN_CONNECTOR_MANIFESTS: readonly ConnectorExtensionManifest[] =
  [
    {
      id: "connector.telegram",
      version: "1.0.0",
      name: "Telegram",
      vendor: "ORBIT",
      kind: "connector",
      platform: "telegram",
      authModes: ["official_token"],
      supportsWebhooks: false,
      capabilities: [
        connectorCapability(
          "telegram.publish",
          "Publish message",
          "Send approved Telegram content.",
          "high",
          true,
          "connector:execute",
        ),
        connectorCapability(
          "telegram.message",
          "Send message",
          "Send an approved Telegram message.",
          "high",
          true,
          "connector:execute",
        ),
        connectorCapability(
          "telegram.sync",
          "Validate connection",
          "Check Telegram bot authorization.",
          "medium",
          false,
          "connector:read",
        ),
      ],
      requiredPermissions: ["connector:execute", "connector:read"],
      minOrbitVersion: "0.2.0",
      enabledByDefault: false,
    },
    {
      id: "connector.linkedin",
      version: "1.0.0",
      name: "LinkedIn",
      vendor: "ORBIT",
      kind: "connector",
      platform: "linkedin",
      authModes: ["official_oauth", "official_token"],
      supportsWebhooks: false,
      capabilities: [
        connectorCapability(
          "linkedin.publish",
          "Publish post",
          "Publish approved LinkedIn text through the Posts API.",
          "high",
          true,
          "connector:execute",
        ),
        connectorCapability(
          "linkedin.authorization",
          "Use authorization",
          "Use locally stored authorization material.",
          "medium",
          false,
          "connector:read",
        ),
      ],
      requiredPermissions: ["connector:execute", "connector:read"],
      minOrbitVersion: "0.2.0",
      enabledByDefault: false,
    },
  ];

export const BUILT_IN_VERTICAL_PACKS: readonly VerticalPackManifest[] = [
  vertical(
    "vertical.real-estate",
    "Real Estate",
    "real_estate",
    ["lead", "qualified", "opportunity", "negotiation", "won", "lost"],
    ["contact", "property", "campaign", "opportunity"],
    ["lead.follow_up", "property.nurture", "opportunity.progress"],
  ),
  vertical(
    "vertical.agency",
    "Agency",
    "agency",
    ["prospect", "discovery", "proposal", "active", "renewal", "lost"],
    ["client", "campaign", "deliverable", "opportunity"],
    ["client.onboarding", "campaign.delivery", "renewal.follow_up"],
  ),
  vertical(
    "vertical.ecommerce",
    "E-commerce",
    "ecommerce",
    ["visitor", "engaged", "cart", "customer", "repeat", "lost"],
    ["contact", "product", "order", "campaign"],
    ["cart.follow_up", "customer.nurture", "repeat.purchase"],
  ),
  vertical(
    "vertical.b2b",
    "B2B",
    "b2b",
    [
      "prospect",
      "marketing_qualified",
      "sales_qualified",
      "opportunity",
      "customer",
      "expansion",
    ],
    ["contact", "account", "opportunity", "campaign"],
    ["lead.qualification", "opportunity.nurture", "account.expansion"],
  ),
  vertical(
    "vertical.creator",
    "Creator",
    "creator",
    ["audience", "engaged", "subscriber", "buyer", "advocate"],
    ["contact", "content", "offer", "campaign"],
    ["content.publish", "audience.nurture", "offer.launch"],
  ),
];

export const BUILT_IN_PLATFORM_MANIFESTS: readonly PlatformExtensionManifest[] =
  [...BUILT_IN_CONNECTOR_MANIFESTS, ...BUILT_IN_VERTICAL_PACKS];
