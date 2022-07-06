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
    hasManagePermission: <boolean>true,
  },

  /**
   * 页面创建时执行
   */
  onLoad(): void {
    let that = this;

    that.checkHasLocalAvatarPath();
    that.checkHasLocalNickname();
    that.getCalendarInfo();
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
  }
})