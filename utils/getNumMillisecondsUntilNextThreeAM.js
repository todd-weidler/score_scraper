
module.exports = function getNumMillisecondsUntilNextThreeAM(){

  const nextThreeAM = new Date();
  const curUTCHour = new Date().getUTCHours();

  // if it is past midnight ET
  if(curUTCHour >= 4 && curUTCHour <= 7){
    nextThreeAM.setUTCHours(7);
    console.log('here1');
  }
  else{
    nextThreeAM.setUTCDate(nextThreeAM.getUTCDate() + 1);
    nextThreeAM.setUTCHours(7);
    console.log('here2');
  }

  nextThreeAM.setUTCMinutes(0);
  nextThreeAM.setUTCSeconds(0);

  console.log(nextThreeAM.toString());

  const numMilliseconds = Math.max(nextThreeAM.getTime() - new Date().getTime(), 0);
  console.log(numMilliseconds);

  return numMilliseconds;
}
