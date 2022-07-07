/**
 * @file 我的页面
 * @author Trick
 * @createDate 2022-07-06
 */
const mineApp = getApp<IAppOption>(); // App全局管理

Page({
  /** 页面的初始数据 */
  data: {
    /** 是否显示弹窗 */
    isShowPopup: <boolean>false,
    /** 用户头像路径 */
    localAvatarPath: <string>mineApp.checkHasLocalFilePath('localAvatarPath'),
    /** 用户昵称 */
    nickname: <string>(wx.getStorageSync(mineApp.globalData.nicknameCacheName) ? wx.getStorageSync(mineApp.globalData.nicknameCacheName) : '昵称'),
    /** 万年历 */
    calendar: <calendar>(wx.getStorageSync(mineApp.globalData.calendarCacheName) ? wx.getStorageSync(mineApp.globalData.calendarCacheName) : {}),
    /** 是否有管理权限 */
    hasManagePermission: <boolean>(wx.getStorageSync(mineApp.globalData.hasManagePermissionCacheName) ? wx.getStorageSync(mineApp.globalData.hasManagePermissionCacheName) : false),
    /** 是否显示设置昵称页面 */
    isShowSetNicknameView: <boolean>false,
    /** 设置昵称的内容 */
    setNicknameContent: <string>'',
    /** 是否显示设置公告页面 */
    isShowSetNoticeView: <boolean>false,
    /** 设置公告的内容 */
    setNoticeContent: <string>'',
  },

  /**
   * 页面创建时执行
   */
  onLoad(): void {
    let that = this;

    that.checkHasLocalAvatarPath();
    that.checkHasLocalNickname();
    that.getCalendarInfo();
    that.getManagePermission();
  },

  /**
   * 回忆页分享配置
   */
  onShareAppMessage(): AnyObject {
    let memorySharePicKey: string = 'imh_share_memory.png';
    let memorySharePicLocalPath: string = mineApp.checkHasLocalFilePath(memorySharePicKey);
    let promise: Promise<AnyObject> = new Promise((resolve) => {
      if (memorySharePicLocalPath === '') {
        mineApp.downloadTempFilePath(memorySharePicKey, mineApp.globalData.memorySharePicCloudPath).then((res) => {
          resolve({
            title: '记录关于你的回忆',
            path: '/pages/memory/memory',
            imageUrl: res,
          })
        }).catch(() => {
          mineApp.showToast('网络异常请重试');
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
   * 检测本地头像路径是否存在
   */
  async checkHasLocalAvatarPath(): Promise<void> {
    let that = this;

    try {
      let localAvatarPathKey: string = 'localAvatarPath';
      let localAvatarPath: string = mineApp.checkHasLocalFilePath(localAvatarPathKey);

      if (localAvatarPath === '') {
        let userInfo: AnyObject = await that.getUserInfoFromCloud();

        if (userInfo.cloudAvatarPath) {
          localAvatarPath = await mineApp.downloadTempFilePath(localAvatarPathKey, userInfo.cloudAvatarPath);
          that.setData({
            localAvatarPath: <string>localAvatarPath
          })
        }
      }
    } catch (err) {
      mineApp.showToast('网络异常请重试');
    }
  },

  /**
   * 从云端获取用户信息
   */
  async getUserInfoFromCloud(): Promise<AnyObject> {
    let userInfo: AnyObject = {};

    try {
      await wx.cloud.callFunction({
        name: 'getUserInfo'
      }).then((res) => {
        if (res.result && res.result.result) {
          userInfo = res.result.userInfo;
        }
      }).catch(() => {
        mineApp.showToast('网络异常请重试');
      })
    } catch (err) {
      mineApp.showToast('网络异常请重试');
    }

    return userInfo;
  },

  /**
   * 检测本地缓存昵称是否存在
   */
  async checkHasLocalNickname(): Promise<void> {
    let that = this;

    try {
      let userInfo: AnyObject = await that.getUserInfoFromCloud();
      let nicknameCache: string = wx.getStorageSync(mineApp.globalData.nicknameCacheName);

      if (userInfo.nickname && nicknameCache !== userInfo.nickname) {
        wx.setStorageSync(mineApp.globalData.nicknameCacheName, userInfo.nickname);
        that.setData({
          nickname: <string>userInfo.nickname
        })
      }
    } catch (err) {
      mineApp.showToast('网络异常请重试');
    }
  },

  /**
   * 获取万年历信息
   */
  async getCalendarInfo(): Promise<void> {
    let that = this;

    try {
      let currentUserInfo: AnyObject = await that.getCurrentUserInfo();
      let currentDate: string = currentUserInfo.currentDate.slice(0, 10);
      let calendarCache: calendar = wx.getStorageSync(mineApp.globalData.calendarCacheName);
      let calendarData: calendar = that.initCalendarData();

      if (calendarCache && calendarCache.date === currentDate) return;
      wx.request({
        url: 'https://api.djapi.cn/wannianli/get',
        data: {
          date: currentDate,
          cn_to_unicode: '1',
          token: '37555a616248cb486ca0e60c10eca164',
          datatype: 'json'
        },
        header: {
          'content-type': 'application/json'
        },
        success: (res: any) => {
          let result: AnyObject = res.data.Result;

          calendarData.date = currentDate;
          calendarData.year = result.nianci.slice(0, 3);
          calendarData.month = result.nianci.slice(3, 6);
          calendarData.day = result.nianci.slice(6, 9);
          calendarData.zodiac = result.shengxiao;
          calendarData.lunar = result.nongli.slice(3, 7);
          calendarData.solarTerm = result.jieqi;
          calendarData.suitable = result.do;
          calendarData.tapu = result.nodo;
          wx.setStorageSync(mineApp.globalData.calendarCacheName, calendarData);
          that.setData({
            calendar: <calendar>calendarData
          })
        },
        fail: () => { }
      })
    } catch (err) {
      mineApp.showToast('网络异常请重试');
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
   * 初始化万年历数据
   */
  initCalendarData(): calendar {
    let calendarData: calendar = {
      date: '',
      year: '',
      month: '',
      day: '',
      zodiac: '',
      lunar: '',
      solarTerm: '',
      suitable: '',
      tapu: ''
    };

    return calendarData;
  },

  /**
   * 点击设置头像事件
   */
  onClickSetAvatar(): void {
    let that = this;

    try {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['compressed']
      }).then(async (res) => {
        wx.showLoading({
          title: '设置中...',
          mask: true
        })
        let tempFiles: WechatMiniprogram.MediaFile[] = res.tempFiles;
        let localAvatarPath: string = tempFiles[0].tempFilePath ? tempFiles[0].tempFilePath : '';

        await wx.compressImage({
          src: localAvatarPath
        }).then((res) => {
          localAvatarPath = res.tempFilePath;
        }).catch(() => { })

        let cloudAvatarPath: string = await that.uploadAvatarToCloud(localAvatarPath);

        that.uploadUserInfoToCloud(cloudAvatarPath, '');
        await mineApp.downloadTempFilePath('localAvatarPath', cloudAvatarPath).then((res) => {
          that.setData({
            localAvatarPath: res
          })
          wx.hideLoading();
          mineApp.showToast('设置成功');
        }).catch(() => {
          mineApp.showToast('网络异常请重试');
        })
      })
    } catch (err) {
      mineApp.showToast('网络异常请重试');
    }
  },

  /**
   * 上传本地头像路径到云端
   * @param localAvatarPath 本地头像路径
   * @return 云头像路径
   */
  async uploadAvatarToCloud(localAvatarPath: string): Promise<string> {
    let that = this;
    let cloudAvatarPath: string = '';

    try {
      let currentUserInfo: AnyObject = await that.getCurrentUserInfo();

      await wx.cloud.uploadFile({
        cloudPath: 'userAvatar/' + currentUserInfo.openId + '.jpg',
        filePath: localAvatarPath,
      }).then(res => {
        cloudAvatarPath = res.fileID;
      }).catch(() => { })

    } catch (err) {
      mineApp.showToast('网络异常请重试');
    }

    return cloudAvatarPath;
  },

  /**
   * 上传用户信息到云端
   * @param cloudAvatarPath 云头像路径
   * @param nickname 昵称
   */
  uploadUserInfoToCloud(cloudAvatarPath: string, nickname: string): void {
    try {
      wx.cloud.callFunction({
        name: 'uploadUserInfo',
        data: {
          cloudAvatarPath: cloudAvatarPath,
          nickname: nickname
        }
      }).then(() => { }).catch(() => { })
    } catch (err) {
      mineApp.showToast('网络异常请重试');
    }
  },

  /**
   * 点击设置昵称事件
   */
  onClickSetNickname(): void {
    let that = this;

    that.setData({
      isShowPopup: <boolean>true,
      isShowSetNicknameView: <boolean>true,
      setNicknameContent: <string>''
    })
  },

  /**
   * 监听输入的昵称内容
   * @param e 监听的输入对象
   */
  setNicknameContent(e: WechatMiniprogram.Input): void {
    let that = this;

    try {
      let content: string = e.detail.value;

      that.setData({
        setNicknameContent: <string>content
      })
    } catch (err) {
      mineApp.showToast('网络异常请重试');
    }
  },

  /**
   * 点击设置昵称页的蒙版事件
   */
  onClickSetNicknameMask(): void {
    let that = this;

    that.setData({
      isShowPopup: <boolean>false,
      isShowSetNicknameView: <boolean>false,
      setNicknameContent: <string>''
    })
  },

  /**
   * 点击上传昵称事件
   */
  onClickUploadNickname(): void {
    let that = this;

    try {
      let nickname: string = that.data.setNicknameContent;

      if (!nickname) {
        mineApp.showToast('昵称不能为空');
      } else {
        wx.showModal({
          title: '温馨提示',
          content: '是否设置该昵称',
          cancelText: '取消',
          confirmText: '确定'
        }).then((res) => {
          if (res.confirm) {
            wx.showLoading({
              title: '设置中...',
              mask: true
            })
            wx.setStorageSync(mineApp.globalData.nicknameCacheName, nickname);
            that.uploadUserInfoToCloud('', nickname);
            that.setData({
              isShowPopup: <boolean>false,
              isShowSetNicknameView: <boolean>false,
              setNicknameContent: <string>'',
              nickname: <string>nickname
            })
            wx.hideLoading();
            mineApp.showToast('设置成功');
          }
        }).catch(() => { })
      }
    } catch (err) {
      mineApp.showToast('网络异常请重试');
    }
  },

  /**
   * 获取管理员权限
   */
  getManagePermission(): void {
    let that = this;

    try {
      wx.cloud.callFunction({
        name: 'getManagePermission'
      }).then((res) => {
        if (res.result && res.result.result) {
          if (res.result.hasManagePermission !== wx.getStorageSync(mineApp.globalData.hasManagePermissionCacheName)) {
            wx.setStorageSync(mineApp.globalData.hasManagePermissionCacheName, res.result.hasManagePermission);
            that.setData({
              hasManagePermission: res.result.hasManagePermission
            })
          }
        }
      }).catch(() => { })
    } catch (err) {
      mineApp.showToast('网络异常请重试');
    }
  },

  /**
   * 点击设置公告事件
   */
  onClickSetNotice(): void {
    let that = this;

    that.setData({
      isShowPopup: <boolean>true,
      isShowSetNoticeView: <boolean>true,
      setNoticeContent: <string>''
    })
  },

  /**
   * 监听输入的公告内容
   * @param e 监听的输入对象
   */
  setNoticeContent(e: WechatMiniprogram.Input): void {
    let that = this;

    try {
      let content: string = e.detail.value;

      that.setData({
        setNoticeContent: <string>content
      })
    } catch (err) {
      mineApp.showToast('网络异常请重试');
    }
  },

  /**
   * 点击设置公告页的蒙版事件
   */
  onClickSetNoticeMask(): void {
    let that = this;

    that.setData({
      isShowPopup: <boolean>false,
      isShowSetNoticeView: <boolean>false,
      setNoticeContent: <string>''
    })
  },

  /**
   * 点击上传公告事件
   */
  onClickUploadNotice(): void {
    let that = this;

    try {
      let notice: string = that.data.setNoticeContent;

      if (!notice) {
        mineApp.showToast('公告不能为空');
      } else {
        wx.showModal({
          title: '温馨提示',
          content: '是否设置该公告',
          cancelText: '取消',
          confirmText: '确定'
        }).then((res) => {
          if (res.confirm) {
            wx.showLoading({
              title: '设置中...',
              mask: true
            })
            wx.setStorageSync(mineApp.globalData.noticeCacheName, notice);
            that.uploadNoticeToCloud(notice);
            that.setData({
              isShowPopup: <boolean>false,
              isShowSetNoticeView: <boolean>false,
              setNoticeContent: <string>''
            })
            wx.hideLoading();
            mineApp.showToast('设置成功');
          }
        }).catch(() => { })
      }
    } catch (err) {
      mineApp.showToast('网络异常请重试');
    }
  },

  /**
   * 上传公告到云端
   * @param notice 公告
   */
  uploadNoticeToCloud(notice: string): void {
    try {
      wx.cloud.callFunction({
        name: 'uploadNotice',
        data: {
          notice: notice
        }
      }).then(() => { }).catch(() => { })
    } catch (err) {
      mineApp.showToast('网络异常请重试');
    }
  }
})