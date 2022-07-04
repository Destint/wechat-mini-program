/**
 * @file 回忆页面
 * @author Trick
 * @createDate 2022-06-16
 */
const app = getApp<IAppOption>(); // App全局管理
const recorderManager = wx.getRecorderManager(); // 录音全局管理器

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
    /** 录音播放进度 */
    playRecordProgress: <number>0,
    /** 是否显示添加回忆框 */
    isShowAddMemory: <boolean>false,
  },

  /** 是否正在录音 */
  isRecording: <boolean>false,
  /** 音频播放器 */
  audioPlayer: <WechatMiniprogram.InnerAudioContext>{},

  /**
   * 页面创建时执行
   */
  async onLoad(): Promise<void> {
    // let that = this;
    // wx.showLoading({
    //   title: '载入回忆中',
    //   mask: true
    // })
    // that.getNoticeFromCloud();
    // await that.getMemoryListFromCloud(0);
    // wx.hideLoading();
  },

  /**
   * 回忆页分享配置
   */
  onShareAppMessage(): AnyObject {
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
        }).catch(() => {
          app.showToast('网络异常请重试');
        })
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
  async onPullDownRefresh(): Promise<void> {
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
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 触发上拉触底时执行
   */
  async onReachBottom(): Promise<void> {
    let that = this;

    try {
      let currentIndex: number = that.data.memoryList.length;

      if (currentIndex === that.data.memorySum) {
        app.showToast('回忆到底啦');
      } else {
        wx.showLoading({
          title: '加载回忆中',
          mask: true
        })
        await that.getMemoryListFromCloud(currentIndex);
        wx.hideLoading();
      }
    } catch (err) {
      app.showToast('网络异常请重试');
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
      app.showToast('网络异常请重试');
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
              memoryList: <memoryDetail[]>partialMemoryList,
              memorySum: <number>res.result.memorySum
            })
            wx.setStorageSync(app.globalData.memoryListCacheName, partialMemoryList);
            wx.setStorageSync(app.globalData.memorySumCacheName, res.result.memorySum);
          } else {
            let preMemoryList: memoryDetail[] = that.data.memoryList;

            preMemoryList = preMemoryList.concat(partialMemoryList);
            that.setData({
              memoryList: <memoryDetail[]>preMemoryList
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

    if (!result) app.showToast('网络异常请重试');
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
      app.showToast('网络异常请重试');

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
      app.showToast('网络异常请重试');
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
      app.showToast('网络异常请重试');
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
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 点击添加回忆页的返回事件
   */
  onClickAddMemoryBack(): void {
    let that = this;

    try {
      wx.showModal({
        title: '温馨提示',
        content: '返回会清空当前所记回忆',
        cancelText: '取消',
        confirmText: '确定'
      }).then((res) => {
        if (res.confirm) {
          let memoryDetail: memoryDetail = that.initMemoryCellData();

          that.playRecordEnd();
          that.setData({
            memoryDetail: <memoryDetail>memoryDetail,
            isShowPopup: <boolean>false,
            isShowAddMemory: <boolean>false
          })
        }
      }).catch(() => {
        app.showToast('网络异常请重试');
      })
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 点击添加回忆页的记录事件
   */
  onClickAddMemoryWrite(): void {
    let that = this;

    console.log('当前添加的回忆内容', that.data.memoryDetail);
    that.playRecordEnd();
  },

  /**
   * 监听输入回忆标题
   * @param e 监听的输入对象
   */
  inputMemoryTitle(e: WechatMiniprogram.Input): void {
    let that = this;

    try {
      let title: string = e.detail.value;
      let memoryDetail: memoryDetail = that.data.memoryDetail;

      memoryDetail.title = title;
      that.setData({
        memoryDetail: <memoryDetail>memoryDetail
      })
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 点击添加回忆页的添加图片事件
   */
  onClickAddPic(): void {
    let that = this;

    try {
      let localPicPathList: string[] = that.data.memoryDetail.localPicPathList;

      if (localPicPathList.length >= 5) {
        app.showToast('图片最多记录5张');
      } else {
        let picCount: number = 5 - localPicPathList.length;

        wx.chooseMedia({
          count: picCount,
          mediaType: ['image'],
          sourceType: ['album'],
          sizeType: ['compressed']
        }).then(async (res) => {
          wx.showLoading({
            title: '添加图片中',
            mask: true
          })
          let tempFiles: WechatMiniprogram.MediaFile[] = res.tempFiles;
          let memoryDetail: memoryDetail = that.data.memoryDetail;
          let proArr: Promise<boolean>[] = [];
          let compressedPicList: string[] = [];

          for (let i: number = 0; i < tempFiles.length; i++) {
            proArr.push(new Promise((resolve) => {
              wx.compressImage({
                src: tempFiles[i].tempFilePath
              }).then((res) => {
                compressedPicList[i] = res.tempFilePath;
                resolve(true);
              }).catch(() => {
                resolve(true);
              })
            }))
          }
          await Promise.all(proArr);
          memoryDetail.localPicPathList = localPicPathList.concat(compressedPicList);
          that.setData({
            memoryDetail: <memoryDetail>memoryDetail
          })
          wx.hideLoading();
        }).catch(() => {
          app.showToast('网络异常请重试');
        })
      }
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 点击添加回忆页的删除图片事件
   * @param e 监听的点击对象
   */
  onClickDeletePic(e: WechatMiniprogram.BaseEvent): void {
    let that = this;

    try {
      let index: number = e.currentTarget.dataset.index;
      let memoryDetail: memoryDetail = that.data.memoryDetail;

      memoryDetail.localPicPathList.splice(index, 1);
      that.setData({
        memoryDetail: <memoryDetail>memoryDetail
      })
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 添加回忆页手指触碰开始录音事件
   */
  onTouchStartRecord(): void {
    let that = this;

    try {
      let memoryDetail: memoryDetail = that.data.memoryDetail;

      if (memoryDetail.localRecordPath) {
        app.showToast('请删除已有录音后重试');

        return;
      }
      if (that.isRecording === true) {
        recorderManager.stop();

        return;
      }
      // 监听录音开始事件
      recorderManager.onStart(() => {
        that.isRecording = true;
        wx.showLoading({
          title: '录音中'
        })
      })
      // 监听录音停止事件
      recorderManager.onStop((res) => {
        wx.hideLoading();
        if (res.duration < 1000) {
          app.showToast('录音时间太短');
        } else {
          memoryDetail.localRecordPath = res.tempFilePath;
          memoryDetail.recordDuration = Number((res.duration / 1000).toFixed());
          that.setData({
            memoryDetail: <memoryDetail>memoryDetail
          })
          app.showToast('录音成功');
        }
        that.isRecording = false;
      })
      // 监听录音失败事件
      recorderManager.onError(() => {
        app.showToast('录音失败,请查看录音权限是否开启');
      })
      // 监听录音中断结束事件
      recorderManager.onInterruptionBegin(() => {
        if (that.isRecording === true) recorderManager.stop();
      })
      // 开始录音
      recorderManager.start({
        duration: 120000,
        format: 'mp3'
      })
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 添加回忆页手指松开结束录音事件
   */
  onTouchEndRecord(): void {
    let that = this;

    if (that.isRecording === true) recorderManager.stop();
  },

  /**
   * 添加回忆页手指触碰录音被打断事件
   */
  onTouchCancelRecord(): void {
    let that = this;

    if (that.isRecording === true) recorderManager.stop();
  },

  /**
   * 添加回忆页点击删除录音事件
   */
  onClickDeleteRecord(): void {
    let that = this;

    try {
      wx.showModal({
        title: '温馨提示',
        content: '是否删除当前录音',
        cancelText: '取消',
        confirmText: '确定'
      }).then((res) => {
        if (res.confirm) {
          let memoryDetail: memoryDetail = that.data.memoryDetail;

          that.playRecordEnd();
          memoryDetail.localRecordPath = '';
          memoryDetail.recordDuration = 0;
          that.setData({
            memoryDetail: <memoryDetail>memoryDetail
          })
          app.showToast('删除成功');
        }
      }).catch(() => {
        app.showToast('网络异常请重试');
      })
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 添加回忆页点击播放录音事件
   * @param e 监听的点击对象
   */
  onClickPlayRecord(e: WechatMiniprogram.BaseEvent): void {
    let that = this;

    try {
      let localRecordPath = e.currentTarget.dataset.data;

      if (!localRecordPath) return;
      if (that.data.isPlayRecord === true) {
        if (that.audioPlayer && JSON.stringify(that.audioPlayer) !== '{}') that.audioPlayer.stop();
      } else {
        that.playRecordStart(localRecordPath);
      }
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 开始播放录音
   * @param recordPath 录音地址
   */
  playRecordStart(recordPath: string): void {
    let that = this;

    try {
      if (!recordPath) return;
      that.audioPlayer = wx.createInnerAudioContext();
      that.audioPlayer.src = recordPath;
      that.audioPlayer.onPlay(() => {
        that.setData({
          isPlayRecord: <boolean>true
        })
        that.audioPlayer.duration; // 得调用这句 onTimeUpdate才会执行
      })
      that.audioPlayer.onTimeUpdate(() => {
        let currentTime: number = that.audioPlayer.currentTime ? that.audioPlayer.currentTime : that.data.memoryDetail.recordDuration;

        that.setData({
          playRecordProgress: currentTime / that.data.memoryDetail.recordDuration * 100
        })
      })
      that.audioPlayer.onStop(() => {
        that.playRecordEnd();
      })
      that.audioPlayer.onEnded(() => {
        that.playRecordEnd();
      })
      that.audioPlayer.onError(() => {
        that.playRecordEnd();
      })
      that.audioPlayer.play();
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 录音播放结束
   */
  playRecordEnd(): void {
    let that = this;

    try {
      if (that.audioPlayer && JSON.stringify(that.audioPlayer) !== '{}') {
        that.audioPlayer.destroy();
        that.audioPlayer = <WechatMiniprogram.InnerAudioContext>{};
        that.setData({
          isPlayRecord: <boolean>false,
          playRecordProgress: <number>0
        })
      }
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
 * 监听输入回忆内容
 * @param e 监听的输入对象
 */
  inputMemoryContent(e: WechatMiniprogram.Input): void {
    let that = this;

    try {
      let content: string = e.detail.value;
      let memoryDetail: memoryDetail = that.data.memoryDetail;

      memoryDetail.content = content;
      that.setData({
        memoryDetail: <memoryDetail>memoryDetail
      })
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  }
})