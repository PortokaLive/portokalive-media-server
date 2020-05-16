function getEnv(key) {
  if (process.env.ENVIRONMENT === "PROD") {
    return process.env[key + "_PROD"];
  } else {
    return process.env[key + "_DEV"];
  }
}

module.exports = {
  getEnv,
};
