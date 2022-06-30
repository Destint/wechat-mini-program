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
    memorySum: <number>(wx.getStorageSync(app.globalData.memorySumCacheName) ? wx.getStorageSync(app.globalData.memorySumCacheName) : 0),
    /** 回忆列表 */
    memoryList: <memoryDetail[]>(wx.getStorageSync(app.globalData.memoryListCacheName) ? wx.getStorageSync(app.globalData.memoryListCacheName) : []),
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
    that.getNoticeFromCloud();
    await that.getMemoryListFromCloud(0);
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
   * 触发下拉刷新时执行
   */
  async onPullDownRefresh() {
    let that = this;

    try {
      wx.showLoading({
        title: '更新回忆中',
        mask: true
      })
      that.getNoticeFromCloud();
      await that.getMemoryListFromCloud(0);
      wx.stopPullDownRefresh();
      wx.hideLoading();
    } catch (err) {
      app.showErrorTip();
    }
  },

  /**
   * 触发上拉触底时执行
   */
  async onReachBottom() {
    let that = this;

    try {
      let currentIndex: number = that.data.memoryList.length;

      if (currentIndex === that.data.memorySum) {
        wx.showToast({
          title: '回忆到底啦',
          icon: 'none',
          duration: 1500
        })
      } else {
        wx.showLoading({
          title: '加载回忆中',
          mask: true
        })
        await that.getMemoryListFromCloud(currentIndex);
        wx.hideLoading();
      }
    } catch (err) {
      app.showErrorTip();
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
    }).catch(() => {
      app.showErrorTip();
    })
  },

  /**
   * 从云端获取回忆列表
   * @param currentIndex 当前回忆的索引值(每次获取索引值后最多15条回忆)
   */
  async getMemoryListFromCloud(currentIndex: number): Promise<void> {
    let that = this;
    let promise: Promise<boolean> = new Promise((resolve) => {
      wx.cloud.callFunction({
        name: 'getMemoryList',
        data: {
          currentIndex: currentIndex
        }
      }).then(async (res) => {
        if (res.result && res.result.result) {
          let partialMemoryList: memoryDetail[] = await that.handleMemoryCloudFileToLocal(res.result.partialMemoryList);

          if (currentIndex === 0) {
            that.setData({
              memoryList: partialMemoryList,
              memorySum: res.result.memorySum
            })
            wx.setStorageSync(app.globalData.memoryListCacheName, partialMemoryList);
            wx.setStorageSync(app.globalData.memorySumCacheName, res.result.memorySum);
          } else {
            let preMemoryList: memoryDetail[] = that.data.memoryList;

            preMemoryList = preMemoryList.concat(partialMemoryList);
            that.setData({
              memoryList: preMemoryList
            })
          }
          resolve(true);
        } else {
          resolve(false);
        }
      }).catch(() => {
        resolve(false);
      })
    })
    let result = await promise;

    if (!result) app.showErrorTip();
  },

  /**
   * 处理回忆列表的云文件到本地路径
   * @param memoryList 需要处理的回忆列表
   */
  async handleMemoryCloudFileToLocal(memoryList: memoryDetail[]): Promise<memoryDetail[]> {
    if (!memoryList || memoryList.length === 0) return memoryList;
    let proArr: Promise<boolean>[] = [];

    try {
      for (let i: number = 0; i < memoryList.length; i++) {
        let cloudPicPathList: string[] = memoryList[i].cloudPicPathList;
        let cloudRecordPath: string = memoryList[i].cloudRecordPath;

        if (cloudRecordPath) {
          let localRecordPathDicKey: string = cloudRecordPath.slice(cloudRecordPath.lastIndexOf('/') + 1);
          let localRecordPath: string = app.checkHasLocalFilePath(localRecordPathDicKey);

          if (localRecordPath === '') {
            proArr.push(new Promise((resolve) => {
              app.downloadTempFilePath(localRecordPathDicKey, cloudRecordPath).then((res) => {
                memoryList[i].localRecordPath = res;
                resolve(true);
              }).catch(() => {
                memoryList[i].localRecordPath = '';
                resolve(true);
              })
            }))
            // 限制promise数组最大并发数为8 现为串行 后续需优化
            if (proArr.length === 8) {
              await Promise.all(proArr);
              proArr = [];
            }
          } else {
            memoryList[i].localRecordPath = localRecordPath;
          }
        } else {
          memoryList[i].localRecordPath = '';
        }
        if (!cloudPicPathList || cloudPicPathList.length === 0) continue;
        for (let j: number = 0; j < cloudPicPathList.length; j++) {
          if (!cloudPicPathList[j]) {
            memoryList[i].localPicPathList[j] = '';
          } else {
            let localFilePathDicKey: string = cloudPicPathList[j].slice(cloudPicPathList[j].lastIndexOf('/') + 1);
            let localPicPath: string = app.checkHasLocalFilePath(localFilePathDicKey);

            if (localPicPath === '') {
              proArr.push(new Promise((resolve) => {
                app.downloadTempFilePath(localFilePathDicKey, cloudPicPathList[j]).then((res) => {
                  memoryList[i].localPicPathList[j] = res;
                  resolve(true);
                }).catch(() => {
                  memoryList[i].localPicPathList[j] = '';
                  resolve(true);
                })
              }))
              // 限制promise数组最大并发数为8 现为串行 后续需优化
              if (proArr.length === 8) {
                await Promise.all(proArr);
                proArr = [];
              }
            } else {
              memoryList[i].localPicPathList[j] = localPicPath;
            }
          }
        }
      }
      await Promise.all(proArr);

      return memoryList;
    } catch (err) {
      console.log('处理回忆列表云文件错误', err);
      app.showErrorTip();

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