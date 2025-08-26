# Cetus AMM 部署总结

## 项目概述

Cetus AMM（自动做市商）是一个构建在 Sui 区块链上的去中心化交易协议。本文档总结了部署准备工作、当前状态以及部署到 Sui 测试网的后续步骤。

## 架构概述

Cetus AMM 由几个关键模块组成：

- **amm_swap.move**: 核心 AMM 逻辑，包含流动性池和交换功能
- **amm_router.move**: 多跳交换和优化交易路线的路由器
- **amm_script.move**: 常见操作的高级入口点
- **amm_config.move**: 全局配置和暂停功能
- **amm_utils.move**: 实用功能和辅助函数

## 已完成的部署过程

### ✅ 环境设置
- **Sui CLI 版本**: 1.40.3-homebrew (已安装并验证)
- **网络**: 配置为 Sui 测试网 (`https://fullnode.testnet.sui.io:443`)
- **钱包**: 创建了部署地址 `0x09a140463c56f1099cee123b8b183b484a1c7860cef3be6d6a37bdcd726e17a4`

### ✅ 项目配置
- **Move.toml**: 已更新为正确的测试网框架依赖项
- **依赖项**: 使用 Sui GitHub 仓库的 `framework/testnet` 分支
- **地址映射**: 设置为 `cetus_amm = "0x0"`（部署后将更新）

### ✅ 构建过程
- **编译**: 成功编译，仅存在非阻塞警告
- **已应用的关键修复**: 将 `transfer::transfer` 更改为 `transfer::public_transfer` 以支持 Coin 对象
- **警告**: 存在 8 个 lint 警告，但非阻塞（未使用参数，已弃用函数）

### ✅ 部署前验证
- **Dry Run（预演）**: 已尝试，并识别出版本不匹配问题（已通过标志解决）
- **依赖项**: 所有 Move 模块均编译正确
- **Gas 预算**: 设置为 100,000,000 MIST (0.1 SUI) 用于部署

## ✅ 部署成功

### **部署信息**

**交易详情**
- **交易摘要**: `4HYh5wxBf2t8gpGcbNUyYPpDMNS6iRXWC9umjtLzttXh`
- **部署日期**: 2025 年 8 月 25 日
- **Gas 消耗**: 91,845,080 MIST (~0.092 SUI)
- **状态**: 成功部署到 Sui 测试网

**包信息**
- **包 ID**: `0xe2f4a0385a2b5e31f67095fb4ba99e3048eb05012ba3698ef6c80fbb675fe138`
- **模块**: amm_config, amm_math, amm_router, amm_script, amm_swap, amm_utils
- **版本**: 1

**创建的对象**
- **GlobalPauseStatus ID**: `0x27a51b2510dd1dcf2949197eda3a4ec4bb71100cc2fc873fcbf772e47d8e975b` (共享)
- **AdminCap ID**: `0x2fc12acd6dd4ac5a5e427db099a23455981b168da8309b260655947247d0ca7e` (部署者拥有)
- **UpgradeCap ID**: `0x64db96d87ef347cda46d3a0a53a9ad1fbdfc074ffa158e4f53b26389604ae238` (部署者拥有)

## ✅ 已执行的部署命令

成功执行了以下部署命令：

```bash
cd /Users/nobbyheell/Documents/GitHub/cetus-amm/sui
sui client publish --gas-budget 100000000 --skip-dependency-verification
```

**结果**: 交易成功完成，摘要为 `4HYh5wxBf2t8gpGcbNUyYPpDMNS6iRXWC9umjtLzttXh`

## 预期部署输出

部署将创建几个重要的对象：

### 包对象
- **包 ID**: 主要合约包标识符
- **AdminCap**: 管理权限对象
- **GlobalPauseStatus**: 系统范围的暂停控制对象

### 交易信息
- **交易哈希**: 部署交易 ID
- **Gas 消耗**: 实际 gas 消耗
- **事件**: 部署和初始化事件

## 部署后步骤

### ✅ 1. 配置已更新
```toml
# Move.toml 已使用实际包 ID 更新
[addresses]
cetus_amm = "0xe2f4a0385a2b5e31f67095fb4ba99e3048eb05012ba3698ef6c80fbb675fe138"
```

### 2. 初始化第一个池
```bash
sui client call \
  --package 0xe2f4a0385a2b5e31f67095fb4ba99e3048eb05012ba3698ef6c80fbb675fe138 \
  --module amm_script \
  --function init_pool \
  --type-args <COIN_TYPE_A> <COIN_TYPE_B> \
  --args 0x2fc12acd6dd4ac5a5e427db099a23455981b168da8309b260655947247d0ca7e 3 1000 1 6 \
  --gas-budget 10000000
```

### 3. 添加初始流动性
```bash
sui client call \
  --package 0xe2f4a0385a2b5e31f67095fb4ba99e3048eb05012ba3698ef6c80fbb675fe138 \
  --module amm_script \
  --function add_liquidity \
  --type-args <COIN_TYPE_A> <COIN_TYPE_B> \
  --args <POOL_ID> 0x27a51b2510dd1dcf2949197eda3a4ec4bb71100cc2fc873fcbf772e47d8e975b <COIN_A> <COIN_B> <AMOUNT_A> <AMOUNT_B> <MIN_A> <MIN_B> \
  --gas-budget 10000000
```

## 集成细节

### 前端配置
```javascript
const CONTRACT_CONFIG = {
  packageId: "0xe2f4a0385a2b5e31f67095fb4ba99e3048eb05012ba3698ef6c80fbb675fe138",
  globalPauseStatusId: "0x27a51b2510dd1dcf2949197eda3a4ec4bb71100cc2fc873fcbf772e47d8e975b",
  adminCapId: "0x2fc12acd6dd4ac5a5e427db099a23455981b168da8309b260655947247d0ca7e",
  upgradeCapId: "0x64db96d87ef347cda46d3a0a53a9ad1fbdfc074ffa158e4f53b26389604ae238",
  network: "testnet",
  rpc: "https://fullnode.testnet.sui.io:443"
}
```

### 可用的关键功能
- **交换**: `swap_exact_coinA_for_coinB`, `swap_exact_coinB_for_coinA`
- **流动性**: `add_liquidity`, `remove_liquidity`
- **管理**: `init_pool`, `set_fee_config`, `claim_fee`
- **路由器**: 多跳交换和优化路由

## 安全考虑

### 智能合约安全
- **暂停机制**: 用于紧急停止的全局暂停功能
- **访问控制**: 基于 AdminCap 的权限系统
- **费用管理**: 可配置的交易和协议费用

### 运营安全
- **管理密钥**: AdminCap `0x2fc12acd6dd4ac5a5e427db099a23455981b168da8309b260655947247d0ca7e` - 安全存储
- **升级密钥**: UpgradeCap `0x64db96d87ef347cda46d3a0a53a9ad1fbdfc074ffa158e4f53b26389604ae238` - 安全存储
- **初始流动性**: 需要大量流动性以防止操纵
- **监控**: 设置异常交易模式的警报

## 已知问题和警告

### 非关键警告
1. **未使用的可变参数**: 5 个实例（表面问题）
2. **已弃用的数学函数**: 2 个实例（功能可用但已弃用）
3. **未使用的导入**: 1 个实例（表面问题）
4. **自转账警告**: 1 个实例（linter 建议）

### 已解决的问题
- ✅ **转移函数**: 修复了无效的私有转移调用
- ✅ **依赖项**: 配置了正确的测试网框架
- ✅ **构建过程**: 所有模块均成功编译

## 性能指标

### 预期 Gas 成本
- **部署**: ~100,000,000 MIST (0.1 SUI)
- **池创建**: ~10,000,000 MIST (0.01 SUI)
- **添加流动性**: ~5,000,000 MIST (0.005 SUI)
- **交换**: ~2,000,000 MIST (0.002 SUI)

### 交易限制
- **最大 Gas 预算**: 1,000,000,000 MIST (1 SUI)
- **推荐的缓冲**: 高于估计成本的 20-50%
- **网络拥塞**: 在高峰时段可能需要更高的 gas 价格

## 下一步

### ✅ 立即执行 (已完成)
1. ✅ 成功执行部署命令
2. ✅ 记录了部署输出中的所有对象 ID
3. ✅ 使用包地址更新了 Move.toml
4. 🔄 使用简单池测试基本功能 (下一步)

### 中期
1. 部署主要代币对的测试池
2. 添加大量初始流动性
3. 实施监控和警报
4. 前端集成和测试

### 长期
1. 安全审计和审查
2. 主网部署准备
3. 高级功能和优化
4. 社区治理实施

## 联系方式和支持

### 开发团队
- **仓库**: https://github.com/nobbyheell/cetus-amm
- **文档**: 有关详细说明，请参见 DEPLOYMENT.md
- **架构**: 有关技术详细信息，请参见 ARCHITECTURE.md

### Sui 网络资源
- **测试网水龙头**: https://faucet.testnet.sui.io/
- **浏览器**: https://testnet.suivision.xyz/
- **文档**: https://docs.sui.io/

---

**上次更新**: 2025 年 8 月 25 日  
**状态**: ✅ 成功部署到 Sui 测试网  
**下一次审查**: 池创建和测试