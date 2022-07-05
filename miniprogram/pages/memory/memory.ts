/**
 * @file 回忆页面
 * @author Trick
 * @createDate 2022-06-16
 */
const app = getApp<IAppOption>(); // App全局管理
const recorderManager = wx.getRecorderManager(); // 录音全局管理器
const locationSDK = require('../../utils/qqmap-wx-jssdk.js'); // 引入获取地理位置的SDK
const locationManager = new locationSDK({
  key: '3XKBZ-WP4CG-KQVQM-IJ2WK-7QAE7-2ZFKZ'
}); // 位置管理器

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
  /** 是否正在记录回忆 */
  isWritingMemory: <boolean>false,

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

    that.playRecordEnd();
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
  },

  /**
 * 点击添加回忆页的记录事件
 */
  onClickAddMemoryWrite(): void {
    let that = this;

    try {
      let memoryDetail: memoryDetail = that.data.memoryDetail;

      if (memoryDetail.title === '') {
        app.showToast('回忆标题不能为空');

        return;
      }
      if (that.isWritingMemory === true) return;
      that.isWritingMemory = true;
      wx.showModal({
        title: '温馨提示',
        content: '是否记录当前回忆',
        cancelText: '取消',
        confirmText: '确定'
      }).then(async (res) => {
        if (res.confirm) {
          let checkContent: string = memoryDetail.title + memoryDetail.content;

          wx.showLoading({
            title: '记录中...',
            mask: true
          })
          that.isWritingMemory = false;
          that.playRecordEnd();
          if (!await that.checkMsgSec(checkContent)) {
            wx.hideLoading();
            wx.showModal({
              title: '温馨提示',
              content: '回忆存在违规信息',
              showCancel: false,
              confirmText: '确定'
            })

            return;
          }
          await that.startWriteMemory();
        } else {
          that.isWritingMemory = false;
        }
      })
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 检测内容是否合规
   * @param content 检测的内容
   */
  async checkMsgSec(content: string): Promise<boolean> {
    let result: boolean = true;

    try {
      if (!content) return result;
      await wx.cloud.callFunction({
        name: 'checkMsgSec',
        data: {
          content: content
        }
      }).then((res) => {
        if (res.result && res.result.result && res.result.data && res.result.data.errCode === 0) {
          if (res.result.data.result && res.result.data.result.suggest !== 'pass') {
            result = false;
          }
        }
      }).catch(() => {
        app.showToast('网络异常请重试');
      })
    } catch (err) {
      app.showToast('网络异常请重试');
    }

    return result;
  },

  /**
   * 开始记录回忆
   */
  async startWriteMemory(): Promise<void> {
    let that = this;

    try {
      await that.uploadLocalFileToCloud();
      await that.getCurrentAddressInfo();
      await that.uploadMemoryToCloud();
      that.finishWriteMemory();
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 上传本地文件到云端
   */
  async uploadLocalFileToCloud(): Promise<void> {
    let that = this;
    let proArr: Promise<boolean>[] = [];

    try {
      let memoryDetail: memoryDetail = that.data.memoryDetail;
      let currentUserInfo: AnyObject = await that.getCurrentUserInfo();

      memoryDetail.id = currentUserInfo.currentId;
      memoryDetail.date = currentUserInfo.currentDate;
      if (memoryDetail.localRecordPath !== '') {
        proArr.push(new Promise((resolve) => {
          wx.cloud.uploadFile({
            cloudPath: 'record/' + currentUserInfo.openId + '/' + currentUserInfo.currentId + '.mp3',
            filePath: memoryDetail.localRecordPath
          }).then((res) => {
            memoryDetail.cloudRecordPath = res.fileID;
            resolve(true);
          }).catch(() => {
            resolve(true);
          })
        }))
      }
      for (let i = 0; i < memoryDetail.localPicPathList.length; i++) {
        proArr.push(new Promise((resolve) => {
          wx.cloud.uploadFile({
            cloudPath: currentUserInfo.openId + '/' + currentUserInfo.currentId + i + '.jpg',
            filePath: memoryDetail.localPicPathList[i]
          }).then((res) => {
            memoryDetail.cloudPicPathList[i] = res.fileID;
            resolve(true);
          }).catch(() => {
            resolve(true);
          })
        }))
      }
      await Promise.all(proArr).then(() => {
        that.setData({
          memoryDetail: <memoryDetail>memoryDetail
        })
      }).catch(() => {
        app.showToast('网络异常请重试');
      })
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 获取当前用户信息
   */
  async getCurrentUserInfo(): Promise<AnyObject> {
    let result: AnyObject = {};

    try {
      await wx.cloud.callFunction({
        name: 'getCurrentUserInfo'
      }).then((res) => {
        if (res.result && res.result.result) {
          result = res.result;
        }
      }).catch(() => {
        app.showToast('网络异常请重试');
      })
    } catch (err) {
      app.showToast('网络异常请重试');
    }

    return result;
  },

  /**
   * 获取当前地址信息
   */
  async getCurrentAddressInfo(): Promise<void> {
    let that = this;

    try {
      let p: Promise<boolean> = new Promise((resolve) => {
        wx.startLocationUpdate({
          success: () => {
            wx.onLocationChange(async (res) => {
              wx.offLocationChange();
              wx.stopLocationUpdate();
              await that.getCurrentLocation(res.latitude, res.longitude);
              resolve(true);
            })
            wx.onLocationChangeError(() => {
              wx.offLocationChange();
              wx.stopLocationUpdate();
              resolve(true);
            })
          },
          fail: () => {
            resolve(true);
          }
        })
      })

      await p;
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 根据经纬度获取当前位置信息
   * @param latitude 纬度
   * @param longitude 经度
   */
  async getCurrentLocation(latitude: number, longitude: number): Promise<void> {
    let that = this;

    try {
      let p: Promise<boolean> = new Promise((resolve) => {
        locationManager.reverseGeocoder({
          location: {
            latitude: latitude,
            longitude: longitude
          },
          success: async (res: any) => {
            if (res && res.result) {
              let address: string = res.result.address ? res.result.address : ''; // 详细地址
              let city: string = res.result.ad_info.city ? res.result.ad_info.city : ''; // 城市
              let district: string = res.result.ad_info.district ? res.result.ad_info.district : ''; // 区
              let simpleAddress: string = district ? district : city; // 简易地址

              await that.getCurrentWeather(simpleAddress, address);
            }
            resolve(true);
          },
          fail: () => {
            resolve(true);
          }
        })
      })

      await p;
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 根据地址获取天气信息
   * @param simpleAddress 简易地址
   * @param address 详细地址
   */
  async getCurrentWeather(simpleAddress: string, address: string): Promise<void> {
    let that = this;

    try {
      let memoryDetail: memoryDetail = that.data.memoryDetail;
      let p: Promise<boolean> = new Promise((resolve) => {
        wx.request({
          url: 'https://free-api.heweather.net/s6/weather/now',
          data: {
            location: simpleAddress,
            key: "2ce65b27e7784d0f85ecd7b8127f5e2d"
          },
          success: (res: any) => {
            let weather: string = res.data.HeWeather6[0].now.cond_txt;
            let temperature: string = res.data.HeWeather6[0].now.fl + '℃';

            memoryDetail.address = address + ' ' + weather + ' ' + temperature;
            memoryDetail.simpleAddress = simpleAddress + ' ' + weather + ' ' + temperature;
            that.setData({
              memoryDetail: <memoryDetail>memoryDetail
            })
            resolve(true);
          },
          fail: () => {
            resolve(true);
          }
        })
      })

      await p;
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 上传添加的回忆到云端
   */
  async uploadMemoryToCloud(): Promise<void> {
    let that = this;

    try {
      let memoryDetail: memoryDetail = that.data.memoryDetail;

      await wx.cloud.callFunction({
        name: 'uploadMemory',
        data: {
          memory: memoryDetail
        }
      }).then(async (res) => {
        if (res.result && res.result.result) {
          let partialMemoryList: memoryDetail[] = await that.handleMemoryCloudFileToLocal(res.result.partialMemoryList);

          that.setData({
            memoryList: <memoryDetail[]>partialMemoryList,
            memorySum: <number>res.result.memorySum
          })
          wx.setStorageSync(app.globalData.memoryListCacheName, partialMemoryList);
          wx.setStorageSync(app.globalData.memorySumCacheName, res.result.memorySum);
        }
      }).catch(() => {
        app.showToast('网络异常请重试');
      })
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 添加回忆完成
   */
  finishWriteMemory(): void {
    let that = this;

    try {
      let memoryDetail: memoryDetail = that.initMemoryCellData();

      that.setData({
        memoryDetail: <memoryDetail>memoryDetail,
        isShowPopup: <boolean>false,
        isShowAddMemory: <boolean>false
      })
      wx.hideLoading();
      app.showToast('记录成功');
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 点击回忆列表的编辑事件
   * @param e 监听点击的对象
   */
  onClickEditorMemory(e: WechatMiniprogram.BaseEvent): void {
    let that = this;

    try {
      let memoryId: number = e.currentTarget.dataset.id;
      let memoryTitle: string = e.currentTarget.dataset.title;

      wx.showActionSheet({
        itemList: ['删除该回忆'],
        success: (res) => {
          if (res.tapIndex === 0) that.deleteMemoryById(memoryId, memoryTitle);
        },
        fail: () => {
          app.showToast('网络异常请重试');
        }
      })
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  },

  /**
   * 通过回忆id删除回忆
   * @param memoryId 要删除的回忆的id
   * @param memoryTitle 要删除的回忆的标题
   */
  deleteMemoryById(memoryId: number, memoryTitle: string): void {
    let that = this;

    try {
      wx.showModal({
        title: '温馨提示',
        content: '是否删除回忆《' + memoryTitle + '》',
        cancelText: '取消',
        confirmText: '确定'
      }).then(async (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...',
            mask: true
          })
          await wx.cloud.callFunction({
            name: 'deleteMemory',
            data: {
              memoryId: memoryId
            }
          }).then((res) => {
            if (res.result && res.result.result) {
              let memoryList: memoryDetail[] = that.data.memoryList;
              let memorySum: number = that.data.memorySum;
              let deleteMemory: memoryDetail = <memoryDetail>memoryList.find((object) => {
                return object.id === memoryId;
              })
              let deleteMemoryIndex: number = memoryList.findIndex((object) => {
                return object.id === memoryId;
              })
              let cloudPicPathList: string[] = deleteMemory.cloudPicPathList;
              let cloudRecordPath: string = deleteMemory.cloudRecordPath;

              for (let i = 0; i < cloudPicPathList.length; i++) {
                if (cloudPicPathList[i]) {
                  let localFilePathDicKey: string = cloudPicPathList[i].slice(cloudPicPathList[i].lastIndexOf('/') + 1);

                  app.deleteLocalFilePathDic(localFilePathDicKey);
                }
              }
              if (cloudRecordPath) {
                let localFilePathDicKey: string = cloudRecordPath.slice(cloudRecordPath.lastIndexOf('/') + 1);

                app.deleteLocalFilePathDic(localFilePathDicKey);
              }
              memoryList.splice(deleteMemoryIndex, 1);
              memorySum = memorySum - 1;
              that.setData({
                memoryList: <memoryDetail[]>memoryList,
                memorySum: <number>memorySum
              })
              wx.setStorageSync(app.globalData.memoryListCacheName, memoryList.slice(0, 15));
              wx.setStorageSync(app.globalData.memorySumCacheName, memorySum);
              wx.hideLoading();
              app.showToast('删除成功');
            } else {
              app.showToast('网络异常请重试');
            }
          }).catch(() => {
            app.showToast('网络异常请重试');
          })
        }
      })
    } catch (err) {
      app.showToast('网络异常请重试');
    }
  }
})