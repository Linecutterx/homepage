import crowdsecProxyHandler from "./proxy";

const widget = {
  api: "{url}/v1/{endpoint}",
  loginURL: "{url}/v1/watchers/login",
  proxyHandler: crowdsecProxyHandler,

  mappings: {
    bans: {
      endpoint: "decisions?type=ban&origins=crowdsec",
    },
    captchas: {
      endpoint: "decisions?type=captcha&origins=crowdsec",
    },
    rateLimits: {
      endpoint: "decisions?type=rate-limit&origins=crowdsec",
    },
  },
};

export default widget;
