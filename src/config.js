module.exports = {
  // URL to submit reasoning requests to.
  JPHYLOREF_SUBMISSION_URL: 'http://phyloref.ggvaidya.com/reason',

  // X-Hub-Signature secret used to communicate with JPhyloRef.
  JPHYLOREF_X_HUB_SIGNATURE_SECRET: 'undefined',

  // URL to match names against the Open Tree TNRS.
  OTT_API_TNRS_MATCH_NAMES: 'https://api.opentreeoflife.org/v3/tnrs/match_names',

  // URL to submit OTT induced subtree requests to.
  OTT_API_INDUCED_SUBTREE: 'https://ot39.opentreeoflife.org/v3/tree_of_life/induced_subtree',
};
