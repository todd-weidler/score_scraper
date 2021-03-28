module.exports = function customUTCDateStr(date){

  return date.toISOString().replace(/T/, '-').replace(/\..+/, '') .slice(0, -3);
}

