-- 1) 체인
CREATE TABLE `chains` (
  `id`           bigint        NOT NULL PRIMARY KEY AUTO_INCREMENT,
  `name`         varchar(100)  NOT NULL,
  `rpcUrl`       varchar(500)  NOT NULL,
  `chainId`      int           NOT NULL,
  `created_at`   timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) 지갑
CREATE TABLE `wallets` (
  `id`           bigint        NOT NULL PRIMARY KEY AUTO_INCREMENT,
  `address`      varchar(100)  NOT NULL,
  `nickname`     varchar(100)  DEFAULT NULL,
  `lastLoginAt`  timestamp     NULL DEFAULT NULL,
  `created_at`   timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) 구독
CREATE TABLE `subscriptions` (
  `id`             bigint        NOT NULL PRIMARY KEY AUTO_INCREMENT,
  `chainId`        int            NOT NULL,
  `description`    varchar(255)   DEFAULT NULL,
  `contractAddress`varchar(100)   NOT NULL,
  `eventName`      varchar(100)   NOT NULL,
  `abi`            json           NOT NULL,
  `fromBlock`      int            DEFAULT NULL,
  `isActive`       boolean        NOT NULL DEFAULT TRUE,
  `created_at`     timestamp      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     timestamp      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_sub_chain` (`chainId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) 수집된 이벤트
CREATE TABLE `collected_events` (
  `id`               bigint        NOT NULL PRIMARY KEY AUTO_INCREMENT,
  `subscriptionId`   bigint        NOT NULL,
  `chainId`          bigint        NOT NULL,
  `contractAddress`  varchar(100)  NOT NULL,
  `eventName`        varchar(100)  NOT NULL,
  `blockNumber`      bigint        NOT NULL,
  `transactionHash`  varchar(100)  NOT NULL,
  `data`             json          NOT NULL,
  `created_at`       timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_evt_sub_block` (`subscriptionId`, `blockNumber`),
  KEY `idx_evt_chain_block` (`chainId`, `blockNumber`),
  KEY `idx_evt_tx` (`transactionHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
