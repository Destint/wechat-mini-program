const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const formatNumber = n => {
  n = n.toString();

  return n[1] ? n : `0${n}`;
}

function formatTime(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  return `${[year, month, day].map(formatNumber).join('-')} ${[hour, minute, second].map(formatNumber).join(':')}`;
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();

    return {
      result: true,
      currentDate: formatTime(new Date()),
      currentId: new Date().getTime(),
      openId: wxContext.OPENID
    }
  } catch (e) {
    return {
      result: false,
      errMsg: e
    }
  }
}