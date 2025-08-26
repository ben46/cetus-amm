# Cetus AMM 对象所有权架构文档

## 概述

本文档详细说明了 Cetus AMM 合约中的对象所有权设计，包括共享对象、拥有对象和不可变对象的架构模式。

## 核心对象类型架构

### 对象所有权层次结构

```mermaid
graph TB
    subgraph "Package Level (Immutable)"
        P[Package ID<br/>0xe2f4a0385a2b5e31f67095fb4ba99e3048eb05012ba3698ef6c80fbb675fe138]
        P --> M1[amm_swap Module]
        P --> M2[amm_config Module]  
        P --> M3[amm_router Module]
        P --> M4[amm_script Module]
        P --> M5[amm_utils Module]
        P --> M6[amm_math Module]
    end

    subgraph "Global Shared Objects"
        GPS[GlobalPauseStatus<br/>0x27a51b2510dd1dcf2949197eda3a4ec4bb71100cc2fc873fcbf772e47d8e975b<br/>🌐 Shared]
    end

    subgraph "Dynamic Shared Objects"
        POOL1["Pool<SUI, USDC><br/>🌐 Shared<br/>Created when init_pool called"]
        POOL2["Pool<USDC, USDT><br/>🌐 Shared<br/>Created when init_pool called"]
        POOL3["Pool<...><br/>🌐 Shared<br/>More pools..."]
    end

    subgraph "Owned Objects - Admin"
        AC[AdminCap<br/>0x2fc12acd6dd4ac5a5e427db099a23455981b168da8309b260655947247d0ca7e<br/>👤 Owned by Deployer]
        UC[UpgradeCap<br/>0x64db96d87ef347cda46d3a0a53a9ad1fbdfc074ffa158e4f53b26389604ae238<br/>👤 Owned by Deployer]
    end

    subgraph "Owned Objects - Users"
        C1["Coin<SUI><br/>👤 Owned by User1"]
        C2["Coin<USDC><br/>👤 Owned by User1"]
        LP1["Coin<PoolLiquidityCoin<SUI,USDC>><br/>👤 Owned by User1"]
        
        C3["Coin<SUI><br/>👤 Owned by User2"]
        C4["Coin<USDT><br/>👤 Owned by User2"]
        LP2["Coin<PoolLiquidityCoin<USDC,USDT>><br/>👤 Owned by User2"]
    end

    M1 -.-> GPS
    M2 -.-> GPS
    AC --> POOL1
    AC --> POOL2
    GPS --> POOL1
    GPS --> POOL2
```

## 对象详细分析

### 1. 不可变对象 (Immutable Objects)

#### Package 对象
```rust
// 部署时创建，永不可变
Package ID: 0xe2f4a0385a2b5e31f67095fb4ba99e3048eb05012ba3698ef6c80fbb675fe138
```

**特征**：
- ✅ 任何人都可以调用其中的公开函数
- ❌ 部署后无法修改代码（除非升级）
- 🔄 所有函数调用都引用这个 Package ID

### 2. 共享对象 (Shared Objects)

#### GlobalPauseStatus - 全局控制中心

```mermaid
graph LR
    subgraph "GlobalPauseStatus Object"
        GPS["`**Object ID:**
        0x27a51b2510dd1dcf2949197eda3a4ec4bb71100cc2fc873fcbf772e47d8e975b
        
        **Fields:**
        • pause: bool
        
        **Access:**
        🔍 Read: Everyone
        ✏️ Write: AdminCap only`"]
    end
    
    subgraph "Usage in Functions"
        F1[swap_exact_coinA_for_coinB]
        F2[add_liquidity]
        F3[remove_liquidity]
        F4[flash_swap]
    end
    
    GPS --> F1
    GPS --> F2
    GPS --> F3
    GPS --> F4
```

**代码实现**：
```rust
// amm_config.move:14-17
struct GlobalPauseStatus has key {
    id: UID,
    pause: bool,
}

// 创建时立即共享
fun init(ctx: &mut TxContext) {
    let global_pause_status = GlobalPauseStatus {
        id: object::new(ctx),
        pause: false
    };
    transfer::share_object(global_pause_status);  // 🌐 设为共享
}
```

#### Pool 对象 - 流动性池

```mermaid
graph TB
    subgraph "Pool Object Structure"
        POOL["`**Pool<CoinA, CoinB>**
        
        **Core Balances:**
        • coin_a: Balance<CoinA>
        • coin_b: Balance<CoinB>
        
        **Admin Fees:**
        • coin_a_admin: Balance<CoinA>
        • coin_b_admin: Balance<CoinB>
        
        **LP Management:**
        • lp_locked: Balance<LP>
        • lp_supply: Supply<LP>
        
        **Fee Configuration:**
        • trade_fee_numerator: u64
        • protocol_fee_numerator: u64`"]
    end
    
    subgraph "Concurrent Access Pattern"
        U1[User1 Transaction] 
        U2[User2 Transaction]
        U3[User3 Transaction]
    end
    
    U1 -->|"🔒 Exclusive Access"| POOL
    U2 -->|"⏳ Wait in Queue"| POOL
    U3 -->|"⏳ Wait in Queue"| POOL
```

**并发访问规则**：
```rust
// 所有修改 Pool 的操作都需要 &mut Pool 引用
public fun swap(
    pool: &mut Pool<CoinA, CoinB>,  // 🔒 独占访问
    // ...
) {
    // 修改池子状态
    // 同时只能有一个交易执行
}
```

### 3. 拥有对象 (Owned Objects)

#### AdminCap - 管理员权限令牌

```mermaid
graph LR
    subgraph "AdminCap Ownership"
        AC["`**AdminCap**
        ID: 0x2fc12acd...
        
        **Owner:**
        0x09a140463c56f1099cee123b8b183b484a1c7860cef3be6d6a37bdcd726e17a4`"]
    end
    
    subgraph "Admin Functions"
        F1[init_pool]
        F2[set_fee_config]
        F3[claim_fee]
        F4[pause_protocol]
    end
    
    AC -->|"Required"| F1
    AC -->|"Required"| F2
    AC -->|"Required"| F3
    AC -->|"Required"| F4
```

**权限验证机制**：
```rust
// 无需地址检查，所有权即权限
public fun init_pool<CoinA, CoinB>(
    _admin_cap: &AdminCap,  // 👤 必须拥有才能传入
    // ...
) {
    // 如果能调用到这里，就证明调用者拥有 AdminCap
    // Sui 系统保证了这一点
}
```

#### 用户代币对象

```mermaid
graph TB
    subgraph "User Assets Ownership Model"
        subgraph "User1 Wallet"
            U1C1["Coin<SUI>#001<br/>Balance: 1000"]
            U1C2["Coin<USDC>#002<br/>Balance: 500"]
            U1LP["LP Token#003<br/>Pool: SUI/USDC"]
        end
        
        subgraph "User2 Wallet"  
            U2C1["Coin<SUI>#004<br/>Balance: 2000"]
            U2C2["Coin<USDT>#005<br/>Balance: 1000"]
            U2LP["LP Token#006<br/>Pool: USDC/USDT"]
        end
        
        subgraph "Parallel Processing"
            TX1["User1: SUI -> USDC<br/>Uses #001"]
            TX2["User2: SUI -> USDT<br/>Uses #004"]
        end
    end
    
    U1C1 --> TX1
    U2C1 --> TX2
    TX1 -.->|"✅ Can Run Parallel"| TX2
```

## 交易流程中的所有权变化

### 代币交换流程

```mermaid
sequenceDiagram
    participant User
    participant UserCoin as "Coin<SUI>#123"
    participant Pool as "Pool<SUI,USDC>"
    participant NewCoin as "Coin<USDC>#456"
    participant GlobalStatus as GlobalPauseStatus

    Note over User: User initiates swap
    User->>GlobalStatus: 🔍 Check if paused (read-only)
    GlobalStatus-->>User: ✅ Not paused
    
    User->>Pool: 🔒 Request exclusive access
    Note over Pool: Pool locked for this transaction
    
    User->>UserCoin: 🗑️ Transfer ownership to pool
    Note over UserCoin: Coin consumed/destroyed
    
    Pool->>Pool: 📊 Update internal balances
    Pool->>NewCoin: 🆕 Create new USDC coin
    Pool->>User: 👤 Transfer ownership of new coin
    
    Note over Pool: Pool released, next transaction can proceed
```

### 添加流动性流程

```mermaid
sequenceDiagram
    participant User
    participant CoinA as "Coin<SUI>#001"
    participant CoinB as "Coin<USDC>#002"  
    participant Pool as "Pool<SUI,USDC>"
    participant LPToken as "LP Token#003"

    User->>Pool: 🔒 Request exclusive access
    User->>CoinA: 🗑️ Consume SUI coin
    User->>CoinB: 🗑️ Consume USDC coin
    
    Pool->>Pool: 📊 Update reserves
    Pool->>Pool: 🧮 Calculate LP tokens to mint
    
    Pool->>LPToken: 🆕 Create LP token for user
    Pool->>User: 👤 Transfer LP token ownership
```

### 管理员操作流程

```mermaid
sequenceDiagram
    participant Admin
    participant AdminCap as AdminCap
    participant Pool as "Pool<SUI,USDC>"
    participant GlobalStatus as GlobalPauseStatus

    Note over Admin: Admin wants to create new pool
    Admin->>AdminCap: 🔍 Verify ownership
    AdminCap-->>Admin: ✅ Owner confirmed
    
    Admin->>Pool: 🆕 Create new pool object
    Note over Pool: Pool created as shared object
    
    Admin->>GlobalStatus: 🔍 Reference for new pool
    
    Note over Admin: Admin wants to pause protocol
    Admin->>AdminCap: 🔍 Verify ownership  
    AdminCap-->>Admin: ✅ Owner confirmed
    Admin->>GlobalStatus: ✏️ Set pause = true
```

## 并发性能分析

### 并发能力矩阵

```mermaid
graph LR
    subgraph "High Concurrency ✅"
        H1["Different users<br/>Different coins<br/>transfer operations"]
        H2["Read-only operations<br/>get_reserves<br/>balance queries"]
    end
    
    subgraph "Medium Concurrency ⚡"
        M1["Different users<br/>Different pools<br/>swap operations"]
        M2["Different users<br/>Same pool type<br/>Different instances"]
    end
    
    subgraph "Low Concurrency ⏳"
        L1["Multiple users<br/>Same pool<br/>swap operations"]
        L2["Multiple admin ops<br/>Same shared object"]
    end
    
    style H1 fill:#90EE90
    style H2 fill:#90EE90
    style M1 fill:#FFE4B5
    style M2 fill:#FFE4B5  
    style L1 fill:#FFB6C1
    style L2 fill:#FFB6C1
```

### 性能瓶颈识别

**共享对象热点**：
```mermaid
pie title 交易类型分布对性能的影响
    "高并发操作 (代币转账)" : 60
    "中等并发 (不同池交换)" : 25
    "低并发操作 (同池交换)" : 15
```

## 设计模式和最佳实践

### 1. 最小化共享状态

```rust
// ✅ 好的设计 - 用户状态独立
struct UserPosition has key, store {
    id: UID,
    liquidity: u64,
    // 每个用户独立的对象
}

// ❌ 避免的设计 - 全局用户映射
struct GlobalUserData has key {
    user_positions: Table<address, UserPosition>, // 共享瓶颈
}
```

### 2. 能力导向的权限设计

```mermaid
graph TB
    subgraph "Traditional Permission Model"
        A["Check msg.sender == owner"]
        B["Maintain access control lists"]
        C["Role-based checks"]
    end
    
    subgraph "Capability-Based Model"
        D["Own AdminCap -> Can admin"]
        E["Own LP Token -> Can withdraw"]
        F["Own Coin -> Can spend"]
    end
    
    A -.->|"❌ Runtime checks"| D
    B -.->|"❌ Complex state"| E  
    C -.->|"❌ Gas overhead"| F
    
    style D fill:#90EE90
    style E fill:#90EE90
    style F fill:#90EE90
```

### 3. 原子操作的对象生命周期

```mermaid
graph LR
    subgraph "Atomic Swap Operation"
        A["User owns Coin<SUI>"] 
        B["🔄 Transaction Boundary"]
        C["User owns Coin<USDC>"]
        
        A1["Pool has X SUI, Y USDC"]
        B1["🔄 Same Transaction"]
        C1["Pool has X+1000 SUI, Y-500 USDC"]
    end
    
    A --> B --> C
    A1 --> B1 --> C1
    
    B -.-> B1
    
    style B fill:#FFE4B5
    style B1 fill:#FFE4B5
```

## 安全考虑

### 1. 对象所有权安全性

```rust
// ✅ 安全：系统保证只有owner能调用
public fun spend_coin(coin: Coin<SUI>) {
    // 如果能传入这个参数，就证明调用者拥有它
}

// ❌ 不安全：需要运行时检查  
// public fun spend_coin(coin_id: ID, user: address) {
//     assert!(get_owner(coin_id) == user, ENOT_OWNER);
// }
```

### 2. 共享对象的竞态条件

```mermaid
sequenceDiagram
    participant TX1 as Transaction 1
    participant TX2 as Transaction 2  
    participant Pool as Shared Pool

    Note over Pool: Initial state: 1000 SUI, 500 USDC
    
    TX1->>Pool: 🔒 Lock for read current price
    Note over TX1: Calculate: 100 SUI -> 50 USDC
    
    TX2->>Pool: ⏳ Wait (TX1 has exclusive access)
    
    TX1->>Pool: ✏️ Execute swap
    TX1->>Pool: 🔓 Release lock
    Note over Pool: New state: 1100 SUI, 450 USDC
    
    TX2->>Pool: 🔒 Lock (price has changed!)
    Note over TX2: Must recalculate with new price
    TX2->>Pool: ✏️ Execute swap with updated state
```

## 总结

Cetus AMM 的对象所有权架构体现了 Sui Move 的核心设计哲学：

1. **所有权即安全**：通过对象所有权而非地址检查控制权限
2. **最小化共享**：减少共享对象以提高并发性能
3. **原子操作**：复杂的状态变化在单个交易中原子完成
4. **类型安全**：编译时保证对象类型和所有权的正确性

这种设计在安全性和性能之间取得了良好的平衡，特别适合高频交易的 DeFi 应用场景。

---

**文档版本**: v1.0  
**最后更新**: 2025年8月25日  
**合约版本**: Package `0xe2f4a0385a2b5e31f67095fb4ba99e3048eb05012ba3698ef6c80fbb675fe138`