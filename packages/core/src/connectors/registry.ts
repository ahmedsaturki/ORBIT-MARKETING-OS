import type { Platform } from "../types/index.js";
import type { PlatformConnector } from "./contracts.js";

export class ConnectorRegistry {
  private readonly connectors = new Map<Platform, PlatformConnector>();

  public register(connector: PlatformConnector): void {
    if (this.connectors.has(connector.platform)) {
      throw new Error("Connector already registered: " + connector.platform);
    }
    this.connectors.set(connector.platform, connector);
  }

  public get(platform: Platform): PlatformConnector | undefined {
    return this.connectors.get(platform);
  }

  public require(platform: Platform): PlatformConnector {
    const connector = this.get(platform);
    if (!connector) throw new Error("No connector registered for platform: " + platform);
    return connector;
  }

  public list(): readonly PlatformConnector[] {
    return [...this.connectors.values()];
  }
}
