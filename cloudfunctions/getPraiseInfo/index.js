const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    let praiseDoc = await db.collection('praise').where({
      _id: '2d44d6c2613d99600bc2652a5a24293b'
    }).get();

    if (praiseDoc.data[0]) {
      let praiseList = praiseDoc.data[0].praiseList;
      let isPraiseApp = false;

      if (praiseList.indexOf(wxContext.OPENID) !== -1) isPraiseApp = true;

      return {
        result: true,
        isPraiseApp: isPraiseApp,
        praiseAppSum: praiseList.length
      }
    } else {
      return {
        result: false
      }
    }
  } catch (e) {
    return {
      result: false,
      errMsg: e
    }
  }
}