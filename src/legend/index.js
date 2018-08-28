/**
 * @fileOverview The entry of legend
 * @author sima.zhang
 */
module.exports = {
  Category: require('./category'), // 分类图例
  CatHtml: require('./catHtml'), // 分类图例
  CatPageHtml: require('./catPageHtml'), // 分类图例
  // Tail: require('./tail'), // 尾部跟随图例
  Color: require('./color'), // 颜色图例
  Size: require('./size'), // 大小图例（适用于除映射点大小以外的其他大小）
  SizeCircle: require('./sizeCircle') // 点大小图例
};
