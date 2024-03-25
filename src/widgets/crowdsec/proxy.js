import cache from "memory-cache";

import { httpProxy } from "utils/proxy/http";
import { formatApiCall } from "utils/proxy/api-helpers";
import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";
import widgets from "widgets/widgets";

const proxyName = "crowdsecProxyHandler";
const logger = createLogger(proxyName);
const sessionTokenCacheKey = `${proxyName}__sessionToken`;

async function login(widget, service) {
  const url = new URL(formatApiCall(widgets[widget.type].loginURL, widget));
  const [status, , data] = await httpProxy(url.toString(), {
    method: "POST",
    body: {
      machine_id: widget.username,
      password: widget.password,
      scenarios: [],
    },
  });

  if (!(status === 200) || !data.token) {
    logger.error("Failed to login to Crowdsec API, status: %d", status);
    cache.del(`${sessionTokenCacheKey}.${service}`);
  }
  cache.put(`${sessionTokenCacheKey}.${service}`, data.token, data.expire);
}

export default async function crowdsecProxyHandler(req, res) {
  const { group, service, endpoint } = req.query;

  if (!group || !service) {
    logger.error("Invalid or missing service '%s' or group '%s'", service, group);
    return res.status(400).json({ error: "Invalid proxy service type" });
  }

  const widget = await getServiceWidget(group, service);
  if (!widget || !widgets[widget.type].api) {
    logger.error("Invalid or missing widget for service '%s' in group '%s'", service, group);
    return res.status(400).json({ error: "Invalid widget configuration" });
  }

  if (!cache.get(`${sessionTokenCacheKey}.${service}`)) {
    await login(widget, service);
  }

  const token = `${sessionTokenCacheKey}.${service}`;
  if (!token) {
    return res.status(500).json({ error: "Failed to authenticate with Crowdsec" });
  }

  const url = new URL(formatApiCall(widgets[widget.type].api, { endpoint, ...widget }));

  try {
    const [status, , data] = await httpProxy(url, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (status !== 200) {
      logger.error("Error calling Crowdsec API: %d. Data: %s", status, data);
      return res.status(status).json({ error: "Crowdsec API Error", data });
    }

    return res.status(status).send(data);
  } catch (error) {
    logger.error("Exception calling Crowdsec API: %s", error.message);
    return res.status(500).json({ error: "Crowdsec API Error", message: error.message });
  }
}
