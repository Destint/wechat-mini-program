/**
 * @file 全局APP控制
 * @author Trick
 * @createDate 2022-06-15 
 */
App<IAppOption>({
  globalData: {
    localFilePathDicCacheName: 'localFilePathDic',
    memorySharePicCloudPath: 'cloud://zxj-8gnakc5c52888d77.7a78-zxj-8gnakc5c52888d77-1305877666/share/img_share_memory.png',
    noticeCacheName: 'notice',
    memoryListCacheName: 'memoryList',
    memorySumCacheName: 'memorySum'
  },

  onLaunch() {
    // let that = this;

    wx.cloud.init({
      env: 'zxj-8gnakc5c52888d77',
      traceUser: true
    });
    // that.checkAppVersion();
    // that.uploadAccessToCloud();
  },

  checkAppVersion(): void {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();

      updateManager.onCheckForUpdate((res) => {
        if (res.hasUpdate) {
          updateManager.onUpdateReady(() => {
            updateManager.applyUpdate(); // 强制重启 更新小程序
          })
        }
      })
    }
  },

  uploadAccessToCloud(): void {
    wx.cloud.callFunction({
      name: 'uploadAccess'
    })
  },

  showToast(tip: string): void {
    tip = tip ? tip : '网络异常请重试';
    wx.showToast({
      title: tip,
      icon: 'none',
      duration: 1500
    })
  },

  checkHasLocalFilePath(localFilePathDicKey: string): string {
    let that = this;
    let localFilePath: string = '';

    try {
      const fs = wx.getFileSystemManager();
      let localFilePathDic: { [key: string]: string } = wx.getStorageSync(that.globalData.localFilePathDicCacheName);

      if (localFilePathDicKey && localFilePathDic && localFilePathDic[localFilePathDicKey]) {
        fs.accessSync(localFilePathDic[localFilePathDicKey]);
        localFilePath = localFilePathDic[localFilePathDicKey];
      }
    } catch (err) { }

    return localFilePath;
  },

  async downloadTempFilePath(localFilePathDicKey: string, cloudFilePath: string): Promise<string> {
    let that = this;
    let tempFilePath: string = '';

    try {
      if (localFilePathDicKey && cloudFilePath) {
        await wx.cloud.downloadFile({
          fileID: cloudFilePath
        }).then((res) => {
          let localFilePathDic: { [key: string]: string };

          localFilePathDic = wx.getStorageSync(that.globalData.localFilePathDicCacheName) ? wx.getStorageSync(that.globalData.localFilePathDicCacheName) : {};
          localFilePathDic[localFilePathDicKey] = res.tempFilePath;
          wx.setStorageSync(that.globalData.localFilePathDicCacheName, localFilePathDic);
          tempFilePath = res.tempFilePath;
        }).catch((err) => {
          console.log('图片下载失败1', err)
        })
      }
    } catch (err) {
      console.log('图片下载失败2', err)
    }

    return tempFilePath;
  }
})