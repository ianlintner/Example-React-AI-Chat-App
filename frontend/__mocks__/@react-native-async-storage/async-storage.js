/* Mock for @react-native-async-storage/async-storage */
const createFn = (returnValue) => jest.fn().mockResolvedValue(returnValue);

const AsyncStorage = {
  getItem: createFn(null),
  setItem: createFn(null),
  removeItem: createFn(null),
  clear: createFn(null),
  getAllKeys: createFn([]),
  multiGet: jest.fn(async (keys) => keys.map((k) => [k, null])),
  multiSet: createFn(null),
  multiRemove: createFn(null),
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
