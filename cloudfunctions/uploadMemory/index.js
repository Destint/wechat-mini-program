const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    let memoryDoc = await db.collection('memory').where({
      _openid: wxContext.OPENID
    }).get();
    let memoryList = memoryDoc.data[0].memoryList;

    memoryList.unshift(event.memory);
    await db.collection('memory').where({
      _openid: wxContext.OPENID
    }).update({
      data: {
        memoryList: _.unshift(event.memory)
      }
    })

    return {
      result: true,
      memorySum: memoryList.length,
      partialMemoryList: memoryList.slice(0, 15)
    }
  } catch (e) {
    return {
      result: false,
      errMsg: e
    }
  }
}