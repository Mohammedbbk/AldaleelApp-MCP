const semver = require('semver');

const API_VERSIONS = {
  'v1': '1.0.0',
  'v2': '2.0.0'
};

const DEFAULT_VERSION = 'v1';

const versionMiddleware = (req, res, next) => {
  // Extract version from URL or header
  const urlVersion = req.path.split('/')[1];
  const headerVersion = req.headers['accept-version'];
  
  let version = DEFAULT_VERSION;

  // Check if version from URL is valid
  if (urlVersion && API_VERSIONS[urlVersion]) {
    version = urlVersion;
  }
  // If no URL version, check header version
  else if (headerVersion) {
    // Find the highest compatible version
    version = Object.entries(API_VERSIONS)
      .filter(([_, semverVersion]) => semver.satisfies(semverVersion, headerVersion))
      .sort(([_, a], [__, b]) => semver.compare(b, a))[0]?.[0] || DEFAULT_VERSION;
  }

  // Add version to request object for route handlers
  req.apiVersion = version;
  req.apiSemver = API_VERSIONS[version];

  // Add version to response header
  res.setHeader('X-API-Version', API_VERSIONS[version]);

  next();
};

module.exports = {
  versionMiddleware,
  API_VERSIONS,
  DEFAULT_VERSION
};