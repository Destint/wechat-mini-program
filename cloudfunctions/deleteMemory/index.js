const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    let memoryDoc = await db.collection('memory').where({
      _openid: wxContext.OPENID
    }).get();
    let memoryList = memoryDoc.data[0].memoryList;
    let deleteMemoryIndex = memoryList.findIndex(function (object) {
      return object.id == event.memoryId;
    })
    let cloudPicPathList = memoryList[deleteMemoryIndex].cloudPicPathList;
    let cloudRecordPath = memoryList[deleteMemoryIndex].cloudRecordPath;
    let deleteFilePathList = [];

    if (cloudRecordPath) deleteFilePathList.push(cloudRecordPath);
    for (let i = 0; i < cloudPicPathList.length; i++) {
      if (cloudPicPathList[i]) deleteFilePathList.push(cloudPicPathList[i]);
    }
    if (deleteFilePathList.length !== 0) {
      await cloud.deleteFile({
        fileList: deleteFilePathList
      })
    }
    memoryList.splice(deleteMemoryIndex, 1);
    await db.collection('memory').where({
      _openid: wxContext.OPENID
    }).update({
      data: {
        memoryList: memoryList
      }
    })

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