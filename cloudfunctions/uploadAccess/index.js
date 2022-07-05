const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;
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
    let accessDoc = await db.collection('access').where({
      _openid: wxContext.OPENID
    }).get();
    let currentDate = formatTime(new Date());

    if (!accessDoc.data[0]) {
      let accessList = [];
      accessList.unshift(currentDate);
      await db.collection('access').add({
        data: {
          accessList: accessList,
          _openid: wxContext.OPENID
        }
      });
    } else {
      if (accessDoc.data[0].accessList.length >= 365) {
        let accessList = accessDoc.data[0].accessList.slice(0, 99);

        accessList.unshift(currentDate);
        await db.collection('access').where({
          _openid: wxContext.OPENID
        }).update({
          data: {
            accessList: accessList
          }
        })
      } else {
        await db.collection('access').where({
          _openid: wxContext.OPENID
        }).update({
          data: {
            accessList: _.unshift(currentDate)
          }
        })
      }
    }

    return {
      result: true
    }
  } catch (e) {
    return {
      result: false,
      errMsg: e
    }
  }
}