/**
 * @file 回忆页面
 * @author Trick
 * @createDate 2022-06-16
 */
const app = getApp<IAppOption>();

Page({
  /** 页面的初始数据 */
  data: {
    /** 是否显示弹窗 */
    isShowPopup: <boolean>false,
    /** 公告 */
    notice: <string>(wx.getStorageSync(app.globalData.noticeCacheName) ? wx.getStorageSync(app.globalData.noticeCacheName) : ''),
    /** 回忆总数 */
    memorySum: <number>0,
    /** 回忆列表 */
    memoryList: <memoryDetail[]>[],
    /** 是否显示回忆详情 */
    isShowMemoryDetail: <boolean>false,
    /** 单个回忆详情 */
    memoryDetail: <memoryDetail>{},
    /** 是否播放录音 */
    isPlayRecord: <boolean>false,
    /** 是否显示添加回忆框 */
    isShowAddMemory: <boolean>false,
  },

  /**
   * 页面创建时执行
   */
  async onLoad(): Promise<void> {
    let that = this;

    wx.showLoading({
      title: '载入回忆中',
      mask: true
    })
    // that.getNoticeFromCloud();
    // console.log('开始准备获取回忆列表')
    // await that.getMemoryListFromCloud(0);
    // console.log('获取回忆列表完成3')
    wx.hideLoading();
  },

  /**
   * 回忆页分享配置
   */
  onShareAppMessage() {
    let memorySharePicKey: string = 'imh_share_memory.png';
    let memorySharePicLocalPath: string = app.checkHasLocalFilePath(memorySharePicKey);
    let promise: Promise<AnyObject> = new Promise((resolve) => {
      if (memorySharePicLocalPath === '') {
        app.downloadTempFilePath(memorySharePicKey, app.globalData.memorySharePicCloudPath).then((res) => {
          resolve({
            title: '记录关于你的回忆',
            path: '/pages/memory/memory',
            imageUrl: res,
          })
        }).catch(() => { })
      } else {
        resolve({
          title: '记录关于你的回忆',
          path: '/pages/memory/memory',
          imageUrl: memorySharePicLocalPath,
        })
      }
    })

    return {
      title: '记录关于你的回忆',
      path: '/pages/memory/memory',
      imageUrl: memorySharePicLocalPath,
      promise
    }
  },

  /**
   * 从云端获取公告
   */
  getNoticeFromCloud(): void {
    let that = this;

    wx.cloud.callFunction({
      name: 'getNotice'
    }).then((res) => {
      if (res.result && res.result.result && res.result.notice !== that.data.notice) {
        that.setData({
          notice: <string>res.result.notice
        })
        wx.setStorageSync(app.globalData.noticeCacheName, res.result.notice);
      }
    }).catch(() => { })
  },

  /**
   * 从云端获取回忆列表
   * @param currentIndex 当前回忆的索引值(每次获取索引值后最多15条回忆)
   */
  async getMemoryListFromCloud(currentIndex: number): Promise<void> {
    let that = this;
    let promise: Promise<boolean> = new Promise((resolve) => {
      console.log('开始准备获取回忆列表1')
      wx.cloud.callFunction({
        name: 'getMemoryList',
        data: {
          currentIndex: currentIndex
        }
      }).then(async (res) => {
        if (res.result && res.result.result) {
          console.log('成功获取回忆列表', res.result);
          console.log('开始处理云图片到本地')
          let partialMemoryList: AnyObject[] = await that.handleMemoryCloudPicToLocal(res.result.partialMemoryList);
          console.log('开始处理云图片到本地结束', partialMemoryList)
          resolve(true);
        } else {
          resolve(false);
        }
      }).catch(() => {
        resolve(false);
      })
    })
    console.log('获取回忆列表完成1')
    let result = await promise;
    console.log('获取回忆列表完成2', result)
    if (!result) app.showErrorTip();
  },

  /**
   * 处理回忆列表的云图片到本地路径
   * @param memoryList 需要处理的回忆列表
   */
  async handleMemoryCloudPicToLocal(memoryList: AnyObject[]): Promise<AnyObject[]> {
    if (!memoryList || memoryList.length === 0) return memoryList;
    let that = this;
    let proArr: Promise<boolean>[] = [];

    try {
      for (let i: number = 0; i < memoryList.length; i++) {
        let cloudPicPathList: string[] = memoryList[i].cloudPicPathList;

        console.log('回忆索引' + i + '的云图片列表', cloudPicPathList);
        if (!cloudPicPathList || cloudPicPathList.length === 0) continue;
        for (let j: number = 0; j < cloudPicPathList.length; j++) {
          console.log('开始处理回忆索引' + i + '的云图片列表' + j, cloudPicPathList[j]);
          if (!cloudPicPathList[j]) {
            console.log('处理回忆索引' + i + '的云图片列表' + j + '的云图片不存在');
            memoryList[i].localPicPathList[j] = '';
          } else {
            let localFilePathDicKey: string = cloudPicPathList[j].slice(cloudPicPathList[j].lastIndexOf('/') + 1);
            console.log('开始处理回忆索引' + i + '的云图片列表' + j + '的云图片字典名', localFilePathDicKey);
            let localPicPath: string = app.checkHasLocalFilePath(localFilePathDicKey);
            console.log('开始处理回忆索引' + i + '的云图片列表' + j + '的本地路径', localPicPath);
            if (localPicPath === '') {
              proArr.push(new Promise(async (resolve) => {
                console.log('开始下载回忆索引' + i + '的云图片列表' + j + '的云图片', cloudPicPathList[j]);
                await app.downloadTempFilePath(localFilePathDicKey, cloudPicPathList[j]).then((res) => {
                  console.log('下载回忆索引' + i + '的云图片列表' + j + '的云图片完成', res);
                  memoryList[i].localPicPathList[j] = res;
                  resolve(true);
                }).catch(() => {
                  memoryList[i].localPicPathList[j] = '';
                  resolve(true);
                })
              }))
            } else {
              memoryList[i].localPicPathList[j] = localPicPath;
            }
          }
        }
      }
      // while (proArr.length > 0) {
      //   await Promise.all(proArr.splice(0, 5));
      // }
      // console.log('处理回忆列表云图片完成', memoryList);
      // let done = Promise.race(proArr);
      // done.then(() => {
      //   proArr.splice(proArr.indexOf(done), 1);
      // })
      await Promise.all(proArr).then(() => {
        console.log('处理回忆列表云图片完成', memoryList);
      })
      return memoryList;
    } catch (err) {
      console.log('处理回忆列表云图片错误', err);
      return memoryList;
    }
  },

  /**
   * 点击回忆单元
   * @param e 监听的点击对象
   */
  onClickMemoryCell(e: WechatMiniprogram.BaseEvent): void {
    let that = this;

    try {
      let memoryDetail: memoryDetail = e.currentTarget.dataset.data;

      that.setData({
        memoryDetail: <memoryDetail>memoryDetail,
        isShowPopup: <boolean>true,
        isShowMemoryDetail: <boolean>true
      })
    } catch (err) {
      app.showErrorTip();
    }
  },

  /**
   * 点击回忆详情页蒙版
   */
  onClickMemoryDetailMask(): void {
    let that = this;

    that.setData({
      memoryDetail: <memoryDetail>{},
      isShowPopup: <boolean>false,
      isShowMemoryDetail: <boolean>false
    })
  },

  /**
   * 预览回忆单元的图片
   * @param e 监听的点击对象
   */
  onPreviewMemoryCellPic(e: WechatMiniprogram.BaseEvent): void {
    let that = this;

    try {
      let index: number = e.currentTarget.dataset.index;
      let currentPic: string = that.data.memoryDetail.localPicPathList[index];
      let picList: string[] = that.data.memoryDetail.localPicPathList;


      wx.previewImage({
        current: currentPic,
        urls: picList
      })
    } catch (err) {
      app.showErrorTip();
    }
  },

  /**
   * 初始化回忆单元数据
   */
  initMemoryCellData(): memoryDetail {
    let memoryDetail: memoryDetail = {
      id: 0,
      title: '',
      content: '',
      cloudPicPathList: [],
      localPicPathList: [],
      date: '',
      simpleAddress: '',
      address: '',
      cloudRecordPath: '',
      localRecordPath: '',
      recordDuration: 0
    };

    return memoryDetail;
  },

  /**
   * 点击添加回忆
   */
  onClickAddMemory(): void {
    let that = this;

    try {
      let memoryDetail: memoryDetail = that.initMemoryCellData();

      that.setData({
        memoryDetail: <memoryDetail>memoryDetail,
        isShowPopup: <boolean>true,
        isShowAddMemory: <boolean>true
      })
    } catch (err) {
      app.showErrorTip();
    }
  }
})