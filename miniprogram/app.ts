/**
 * @file 全局APP控制
 * @author Trick
 * @createDate 2022-06-15 
 */
App<IAppOption>({
  // 全局数据
  globalData: {},

  onLaunch() {
    wx.cloud.init({
      env: 'zxj-8gnakc5c52888d77',
      traceUser: true
    });
  },
})