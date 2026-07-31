import Foundation
import Supabase

internal enum GraphqlPublicSchema {
}
internal enum PublicSchema {
  internal struct AppEventUserAliasesSelect: Codable, Hashable, Sendable {
    internal let createdAt: String
    internal let newUserId: UUID
    internal let oldUserId: UUID
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case newUserId = "new_user_id"
      case oldUserId = "old_user_id"
    }
  }
  internal struct AppEventUserAliasesInsert: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let newUserId: UUID
    internal let oldUserId: UUID
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case newUserId = "new_user_id"
      case oldUserId = "old_user_id"
    }
  }
  internal struct AppEventUserAliasesUpdate: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let newUserId: UUID?
    internal let oldUserId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case newUserId = "new_user_id"
      case oldUserId = "old_user_id"
    }
  }
  internal struct AppEventsSelect: Codable, Hashable, Sendable {
    internal let appVersion: String?
    internal let createdAt: String
    internal let event: String
    internal let eventId: UUID
    internal let id: Int64
    internal let props: AnyJSON
    internal let sessionId: String?
    internal let source: String
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case appVersion = "app_version"
      case createdAt = "created_at"
      case event = "event"
      case eventId = "event_id"
      case id = "id"
      case props = "props"
      case sessionId = "session_id"
      case source = "source"
      case userId = "user_id"
    }
  }
  internal struct AppEventsInsert: Codable, Hashable, Sendable {
    internal let appVersion: String?
    internal let createdAt: String?
    internal let event: String
    internal let eventId: UUID?
    internal let id: Int64?
    internal let props: AnyJSON?
    internal let sessionId: String?
    internal let source: String
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case appVersion = "app_version"
      case createdAt = "created_at"
      case event = "event"
      case eventId = "event_id"
      case id = "id"
      case props = "props"
      case sessionId = "session_id"
      case source = "source"
      case userId = "user_id"
    }
  }
  internal struct AppEventsUpdate: Codable, Hashable, Sendable {
    internal let appVersion: String?
    internal let createdAt: String?
    internal let event: String?
    internal let eventId: UUID?
    internal let id: Int64?
    internal let props: AnyJSON?
    internal let sessionId: String?
    internal let source: String?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case appVersion = "app_version"
      case createdAt = "created_at"
      case event = "event"
      case eventId = "event_id"
      case id = "id"
      case props = "props"
      case sessionId = "session_id"
      case source = "source"
      case userId = "user_id"
    }
  }
  internal struct AssessmentRunsSelect: Codable, Hashable, Sendable {
    internal let answers: AnyJSON
    internal let assessmentKind: String
    internal let completedAt: String
    internal let createdAt: String
    internal let id: UUID
    internal let resultTags: [String]
    internal let schemaVersion: Int32
    internal let scores: AnyJSON
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case answers = "answers"
      case assessmentKind = "assessment_kind"
      case completedAt = "completed_at"
      case createdAt = "created_at"
      case id = "id"
      case resultTags = "result_tags"
      case schemaVersion = "schema_version"
      case scores = "scores"
      case userId = "user_id"
    }
  }
  internal struct AssessmentRunsInsert: Codable, Hashable, Sendable {
    internal let answers: AnyJSON?
    internal let assessmentKind: String
    internal let completedAt: String?
    internal let createdAt: String?
    internal let id: UUID?
    internal let resultTags: [String]?
    internal let schemaVersion: Int32?
    internal let scores: AnyJSON?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case answers = "answers"
      case assessmentKind = "assessment_kind"
      case completedAt = "completed_at"
      case createdAt = "created_at"
      case id = "id"
      case resultTags = "result_tags"
      case schemaVersion = "schema_version"
      case scores = "scores"
      case userId = "user_id"
    }
  }
  internal struct AssessmentRunsUpdate: Codable, Hashable, Sendable {
    internal let answers: AnyJSON?
    internal let assessmentKind: String?
    internal let completedAt: String?
    internal let createdAt: String?
    internal let id: UUID?
    internal let resultTags: [String]?
    internal let schemaVersion: Int32?
    internal let scores: AnyJSON?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case answers = "answers"
      case assessmentKind = "assessment_kind"
      case completedAt = "completed_at"
      case createdAt = "created_at"
      case id = "id"
      case resultTags = "result_tags"
      case schemaVersion = "schema_version"
      case scores = "scores"
      case userId = "user_id"
    }
  }
  internal struct BountiesSelect: Codable, Hashable, Sendable {
    internal let createdAt: String
    internal let detail: String
    internal let id: Int64
    internal let question: String
    internal let responses: String
    internal let reward: String
    internal let status: String
    internal let tags: [String]
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case detail = "detail"
      case id = "id"
      case question = "question"
      case responses = "responses"
      case reward = "reward"
      case status = "status"
      case tags = "tags"
      case userId = "user_id"
    }
  }
  internal struct BountiesInsert: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let detail: String?
    internal let id: Int64?
    internal let question: String
    internal let responses: String
    internal let reward: String
    internal let status: String?
    internal let tags: [String]?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case detail = "detail"
      case id = "id"
      case question = "question"
      case responses = "responses"
      case reward = "reward"
      case status = "status"
      case tags = "tags"
      case userId = "user_id"
    }
  }
  internal struct BountiesUpdate: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let detail: String?
    internal let id: Int64?
    internal let question: String?
    internal let responses: String?
    internal let reward: String?
    internal let status: String?
    internal let tags: [String]?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case detail = "detail"
      case id = "id"
      case question = "question"
      case responses = "responses"
      case reward = "reward"
      case status = "status"
      case tags = "tags"
      case userId = "user_id"
    }
  }
  internal struct BountyResponsesSelect: Codable, Hashable, Sendable {
    internal let bountyId: Int64
    internal let createdAt: String
    internal let id: Int64
    internal let message: String
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case bountyId = "bounty_id"
      case createdAt = "created_at"
      case id = "id"
      case message = "message"
      case userId = "user_id"
    }
  }
  internal struct BountyResponsesInsert: Codable, Hashable, Sendable {
    internal let bountyId: Int64
    internal let createdAt: String?
    internal let id: Int64?
    internal let message: String?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case bountyId = "bounty_id"
      case createdAt = "created_at"
      case id = "id"
      case message = "message"
      case userId = "user_id"
    }
  }
  internal struct BountyResponsesUpdate: Codable, Hashable, Sendable {
    internal let bountyId: Int64?
    internal let createdAt: String?
    internal let id: Int64?
    internal let message: String?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case bountyId = "bounty_id"
      case createdAt = "created_at"
      case id = "id"
      case message = "message"
      case userId = "user_id"
    }
  }
  internal struct CardGameActionsSelect: Codable, Hashable, Sendable, Identifiable {
    internal let actionType: String
    internal let cardKeys: [String]
    internal let createdAt: String
    internal let decisionSource: String?
    internal let id: Int64
    internal let pressureAfter: Int32?
    internal let pressureBefore: Int32?
    internal let reasonAbandon: String?
    internal let reasonCannotAccept: String?
    internal let scenarioKey: String?
    internal let sequence: Int32
    internal let sessionId: UUID
    internal enum CodingKeys: String, CodingKey {
      case actionType = "action_type"
      case cardKeys = "card_keys"
      case createdAt = "created_at"
      case decisionSource = "decision_source"
      case id = "id"
      case pressureAfter = "pressure_after"
      case pressureBefore = "pressure_before"
      case reasonAbandon = "reason_abandon"
      case reasonCannotAccept = "reason_cannot_accept"
      case scenarioKey = "scenario_key"
      case sequence = "sequence"
      case sessionId = "session_id"
    }
  }
  internal struct CardGameActionsInsert: Codable, Hashable, Sendable, Identifiable {
    internal let actionType: String
    internal let cardKeys: [String]?
    internal let createdAt: String?
    internal let decisionSource: String?
    internal let id: Int64?
    internal let pressureAfter: Int32?
    internal let pressureBefore: Int32?
    internal let reasonAbandon: String?
    internal let reasonCannotAccept: String?
    internal let scenarioKey: String?
    internal let sequence: Int32
    internal let sessionId: UUID
    internal enum CodingKeys: String, CodingKey {
      case actionType = "action_type"
      case cardKeys = "card_keys"
      case createdAt = "created_at"
      case decisionSource = "decision_source"
      case id = "id"
      case pressureAfter = "pressure_after"
      case pressureBefore = "pressure_before"
      case reasonAbandon = "reason_abandon"
      case reasonCannotAccept = "reason_cannot_accept"
      case scenarioKey = "scenario_key"
      case sequence = "sequence"
      case sessionId = "session_id"
    }
  }
  internal struct CardGameActionsUpdate: Codable, Hashable, Sendable, Identifiable {
    internal let actionType: String?
    internal let cardKeys: [String]?
    internal let createdAt: String?
    internal let decisionSource: String?
    internal let id: Int64?
    internal let pressureAfter: Int32?
    internal let pressureBefore: Int32?
    internal let reasonAbandon: String?
    internal let reasonCannotAccept: String?
    internal let scenarioKey: String?
    internal let sequence: Int32?
    internal let sessionId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case actionType = "action_type"
      case cardKeys = "card_keys"
      case createdAt = "created_at"
      case decisionSource = "decision_source"
      case id = "id"
      case pressureAfter = "pressure_after"
      case pressureBefore = "pressure_before"
      case reasonAbandon = "reason_abandon"
      case reasonCannotAccept = "reason_cannot_accept"
      case scenarioKey = "scenario_key"
      case sequence = "sequence"
      case sessionId = "session_id"
    }
  }
  internal struct CardGameCatalogVersionsSelect: Codable, Hashable, Sendable {
    internal let analysisKey: String
    internal let catalog: AnyJSON
    internal let catalogSchemaVersion: Int16
    internal let contentHash: String?
    internal let createdAt: String
    internal let createdBy: UUID?
    internal let engineKey: String
    internal let gameId: UUID
    internal let id: UUID
    internal let isCurrent: Bool
    internal let publishedAt: String?
    internal let status: String
    internal let version: Int32
    internal enum CodingKeys: String, CodingKey {
      case analysisKey = "analysis_key"
      case catalog = "catalog"
      case catalogSchemaVersion = "catalog_schema_version"
      case contentHash = "content_hash"
      case createdAt = "created_at"
      case createdBy = "created_by"
      case engineKey = "engine_key"
      case gameId = "game_id"
      case id = "id"
      case isCurrent = "is_current"
      case publishedAt = "published_at"
      case status = "status"
      case version = "version"
    }
  }
  internal struct CardGameCatalogVersionsInsert: Codable, Hashable, Sendable {
    internal let analysisKey: String?
    internal let catalog: AnyJSON
    internal let catalogSchemaVersion: Int16?
    internal let contentHash: String?
    internal let createdAt: String?
    internal let createdBy: UUID?
    internal let engineKey: String?
    internal let gameId: UUID
    internal let id: UUID?
    internal let isCurrent: Bool?
    internal let publishedAt: String?
    internal let status: String?
    internal let version: Int32
    internal enum CodingKeys: String, CodingKey {
      case analysisKey = "analysis_key"
      case catalog = "catalog"
      case catalogSchemaVersion = "catalog_schema_version"
      case contentHash = "content_hash"
      case createdAt = "created_at"
      case createdBy = "created_by"
      case engineKey = "engine_key"
      case gameId = "game_id"
      case id = "id"
      case isCurrent = "is_current"
      case publishedAt = "published_at"
      case status = "status"
      case version = "version"
    }
  }
  internal struct CardGameCatalogVersionsUpdate: Codable, Hashable, Sendable {
    internal let analysisKey: String?
    internal let catalog: AnyJSON?
    internal let catalogSchemaVersion: Int16?
    internal let contentHash: String?
    internal let createdAt: String?
    internal let createdBy: UUID?
    internal let engineKey: String?
    internal let gameId: UUID?
    internal let id: UUID?
    internal let isCurrent: Bool?
    internal let publishedAt: String?
    internal let status: String?
    internal let version: Int32?
    internal enum CodingKeys: String, CodingKey {
      case analysisKey = "analysis_key"
      case catalog = "catalog"
      case catalogSchemaVersion = "catalog_schema_version"
      case contentHash = "content_hash"
      case createdAt = "created_at"
      case createdBy = "created_by"
      case engineKey = "engine_key"
      case gameId = "game_id"
      case id = "id"
      case isCurrent = "is_current"
      case publishedAt = "published_at"
      case status = "status"
      case version = "version"
    }
  }
  internal struct CardGameResultsSelect: Codable, Hashable, Sendable {
    internal let accepted: AnyJSON
    internal let createdAt: String
    internal let finalCards: AnyJSON
    internal let id: Int64
    internal let kind: String
    internal let rounds: Int32
    internal let traded: AnyJSON
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case accepted = "accepted"
      case createdAt = "created_at"
      case finalCards = "final_cards"
      case id = "id"
      case kind = "kind"
      case rounds = "rounds"
      case traded = "traded"
      case userId = "user_id"
    }
  }
  internal struct CardGameResultsInsert: Codable, Hashable, Sendable {
    internal let accepted: AnyJSON?
    internal let createdAt: String?
    internal let finalCards: AnyJSON
    internal let id: Int64?
    internal let kind: String
    internal let rounds: Int32?
    internal let traded: AnyJSON?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case accepted = "accepted"
      case createdAt = "created_at"
      case finalCards = "final_cards"
      case id = "id"
      case kind = "kind"
      case rounds = "rounds"
      case traded = "traded"
      case userId = "user_id"
    }
  }
  internal struct CardGameResultsUpdate: Codable, Hashable, Sendable {
    internal let accepted: AnyJSON?
    internal let createdAt: String?
    internal let finalCards: AnyJSON?
    internal let id: Int64?
    internal let kind: String?
    internal let rounds: Int32?
    internal let traded: AnyJSON?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case accepted = "accepted"
      case createdAt = "created_at"
      case finalCards = "final_cards"
      case id = "id"
      case kind = "kind"
      case rounds = "rounds"
      case traded = "traded"
      case userId = "user_id"
    }
  }
  internal struct CardGameRunsSelect: Codable, Hashable, Sendable {
    internal let aiSnapshot: AnyJSON
    internal let analysisKey: String
    internal let analysisSchemaVersion: Int16
    internal let completedAt: String
    internal let discardedCardKeys: [String]
    internal let displaySnapshot: AnyJSON
    internal let finalCardKeys: [String]
    internal let gameId: UUID
    internal let gameVersionId: UUID
    internal let id: UUID
    internal let initialCardKeys: [String]
    internal let metrics: AnyJSON
    internal let sessionId: UUID
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case aiSnapshot = "ai_snapshot"
      case analysisKey = "analysis_key"
      case analysisSchemaVersion = "analysis_schema_version"
      case completedAt = "completed_at"
      case discardedCardKeys = "discarded_card_keys"
      case displaySnapshot = "display_snapshot"
      case finalCardKeys = "final_card_keys"
      case gameId = "game_id"
      case gameVersionId = "game_version_id"
      case id = "id"
      case initialCardKeys = "initial_card_keys"
      case metrics = "metrics"
      case sessionId = "session_id"
      case userId = "user_id"
    }
  }
  internal struct CardGameRunsInsert: Codable, Hashable, Sendable {
    internal let aiSnapshot: AnyJSON
    internal let analysisKey: String
    internal let analysisSchemaVersion: Int16
    internal let completedAt: String?
    internal let discardedCardKeys: [String]
    internal let displaySnapshot: AnyJSON
    internal let finalCardKeys: [String]
    internal let gameId: UUID
    internal let gameVersionId: UUID
    internal let id: UUID?
    internal let initialCardKeys: [String]
    internal let metrics: AnyJSON
    internal let sessionId: UUID
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case aiSnapshot = "ai_snapshot"
      case analysisKey = "analysis_key"
      case analysisSchemaVersion = "analysis_schema_version"
      case completedAt = "completed_at"
      case discardedCardKeys = "discarded_card_keys"
      case displaySnapshot = "display_snapshot"
      case finalCardKeys = "final_card_keys"
      case gameId = "game_id"
      case gameVersionId = "game_version_id"
      case id = "id"
      case initialCardKeys = "initial_card_keys"
      case metrics = "metrics"
      case sessionId = "session_id"
      case userId = "user_id"
    }
  }
  internal struct CardGameRunsUpdate: Codable, Hashable, Sendable {
    internal let aiSnapshot: AnyJSON?
    internal let analysisKey: String?
    internal let analysisSchemaVersion: Int16?
    internal let completedAt: String?
    internal let discardedCardKeys: [String]?
    internal let displaySnapshot: AnyJSON?
    internal let finalCardKeys: [String]?
    internal let gameId: UUID?
    internal let gameVersionId: UUID?
    internal let id: UUID?
    internal let initialCardKeys: [String]?
    internal let metrics: AnyJSON?
    internal let sessionId: UUID?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case aiSnapshot = "ai_snapshot"
      case analysisKey = "analysis_key"
      case analysisSchemaVersion = "analysis_schema_version"
      case completedAt = "completed_at"
      case discardedCardKeys = "discarded_card_keys"
      case displaySnapshot = "display_snapshot"
      case finalCardKeys = "final_card_keys"
      case gameId = "game_id"
      case gameVersionId = "game_version_id"
      case id = "id"
      case initialCardKeys = "initial_card_keys"
      case metrics = "metrics"
      case sessionId = "session_id"
      case userId = "user_id"
    }
  }
  internal struct CardGameSessionsSelect: Codable, Hashable, Sendable {
    internal let acceptCount: Int32
    internal let clientSessionId: UUID
    internal let completedAt: String?
    internal let currentScenarioKey: String?
    internal let gameId: UUID
    internal let gameVersionId: UUID
    internal let heldCardKeys: [String]
    internal let id: UUID
    internal let lastActionSeq: Int32
    internal let phase: String
    internal let pressure: Int32
    internal let roundCount: Int32
    internal let seed: Int64
    internal let seenScenarioKeys: [String]
    internal let selectedCardKeys: [String]
    internal let startedAt: String
    internal let stateVersion: Int32
    internal let status: String
    internal let tradeCount: Int32
    internal let updatedAt: String
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case acceptCount = "accept_count"
      case clientSessionId = "client_session_id"
      case completedAt = "completed_at"
      case currentScenarioKey = "current_scenario_key"
      case gameId = "game_id"
      case gameVersionId = "game_version_id"
      case heldCardKeys = "held_card_keys"
      case id = "id"
      case lastActionSeq = "last_action_seq"
      case phase = "phase"
      case pressure = "pressure"
      case roundCount = "round_count"
      case seed = "seed"
      case seenScenarioKeys = "seen_scenario_keys"
      case selectedCardKeys = "selected_card_keys"
      case startedAt = "started_at"
      case stateVersion = "state_version"
      case status = "status"
      case tradeCount = "trade_count"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct CardGameSessionsInsert: Codable, Hashable, Sendable {
    internal let acceptCount: Int32?
    internal let clientSessionId: UUID
    internal let completedAt: String?
    internal let currentScenarioKey: String?
    internal let gameId: UUID
    internal let gameVersionId: UUID
    internal let heldCardKeys: [String]?
    internal let id: UUID
    internal let lastActionSeq: Int32?
    internal let phase: String?
    internal let pressure: Int32?
    internal let roundCount: Int32?
    internal let seed: Int64
    internal let seenScenarioKeys: [String]?
    internal let selectedCardKeys: [String]?
    internal let startedAt: String?
    internal let stateVersion: Int32?
    internal let status: String?
    internal let tradeCount: Int32?
    internal let updatedAt: String?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case acceptCount = "accept_count"
      case clientSessionId = "client_session_id"
      case completedAt = "completed_at"
      case currentScenarioKey = "current_scenario_key"
      case gameId = "game_id"
      case gameVersionId = "game_version_id"
      case heldCardKeys = "held_card_keys"
      case id = "id"
      case lastActionSeq = "last_action_seq"
      case phase = "phase"
      case pressure = "pressure"
      case roundCount = "round_count"
      case seed = "seed"
      case seenScenarioKeys = "seen_scenario_keys"
      case selectedCardKeys = "selected_card_keys"
      case startedAt = "started_at"
      case stateVersion = "state_version"
      case status = "status"
      case tradeCount = "trade_count"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct CardGameSessionsUpdate: Codable, Hashable, Sendable {
    internal let acceptCount: Int32?
    internal let clientSessionId: UUID?
    internal let completedAt: String?
    internal let currentScenarioKey: String?
    internal let gameId: UUID?
    internal let gameVersionId: UUID?
    internal let heldCardKeys: [String]?
    internal let id: UUID?
    internal let lastActionSeq: Int32?
    internal let phase: String?
    internal let pressure: Int32?
    internal let roundCount: Int32?
    internal let seed: Int64?
    internal let seenScenarioKeys: [String]?
    internal let selectedCardKeys: [String]?
    internal let startedAt: String?
    internal let stateVersion: Int32?
    internal let status: String?
    internal let tradeCount: Int32?
    internal let updatedAt: String?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case acceptCount = "accept_count"
      case clientSessionId = "client_session_id"
      case completedAt = "completed_at"
      case currentScenarioKey = "current_scenario_key"
      case gameId = "game_id"
      case gameVersionId = "game_version_id"
      case heldCardKeys = "held_card_keys"
      case id = "id"
      case lastActionSeq = "last_action_seq"
      case phase = "phase"
      case pressure = "pressure"
      case roundCount = "round_count"
      case seed = "seed"
      case seenScenarioKeys = "seen_scenario_keys"
      case selectedCardKeys = "selected_card_keys"
      case startedAt = "started_at"
      case stateVersion = "state_version"
      case status = "status"
      case tradeCount = "trade_count"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct CardGamesSelect: Codable, Hashable, Sendable {
    internal let createdAt: String
    internal let gameKey: String
    internal let id: UUID
    internal let sortOrder: Int32
    internal let status: String
    internal let updatedAt: String
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case gameKey = "game_key"
      case id = "id"
      case sortOrder = "sort_order"
      case status = "status"
      case updatedAt = "updated_at"
    }
  }
  internal struct CardGamesInsert: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let gameKey: String
    internal let id: UUID?
    internal let sortOrder: Int32?
    internal let status: String?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case gameKey = "game_key"
      case id = "id"
      case sortOrder = "sort_order"
      case status = "status"
      case updatedAt = "updated_at"
    }
  }
  internal struct CardGamesUpdate: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let gameKey: String?
    internal let id: UUID?
    internal let sortOrder: Int32?
    internal let status: String?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case gameKey = "game_key"
      case id = "id"
      case sortOrder = "sort_order"
      case status = "status"
      case updatedAt = "updated_at"
    }
  }
  internal struct ConversationsSelect: Codable, Hashable, Sendable {
    internal let createdAt: String
    internal let crossroads: AnyJSON?
    internal let id: UUID
    internal let status: String
    internal let topic: String
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case crossroads = "crossroads"
      case id = "id"
      case status = "status"
      case topic = "topic"
      case userId = "user_id"
    }
  }
  internal struct ConversationsInsert: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let crossroads: AnyJSON?
    internal let id: UUID?
    internal let status: String?
    internal let topic: String
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case crossroads = "crossroads"
      case id = "id"
      case status = "status"
      case topic = "topic"
      case userId = "user_id"
    }
  }
  internal struct ConversationsUpdate: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let crossroads: AnyJSON?
    internal let id: UUID?
    internal let status: String?
    internal let topic: String?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case crossroads = "crossroads"
      case id = "id"
      case status = "status"
      case topic = "topic"
      case userId = "user_id"
    }
  }
  internal struct DiaryEntriesSelect: Codable, Hashable, Sendable {
    internal let analysis: AnyJSON
    internal let analysisModel: String?
    internal let analysisProvider: String?
    internal let analyzedAt: String?
    internal let attemptCount: Int32
    internal let audioBytes: Int64?
    internal let audioDeletedAt: String?
    internal let audioMime: String?
    internal let audioPath: String?
    internal let contentVersion: Int32
    internal let createdAt: String
    internal let deletedAt: String?
    internal let durationMs: Int32?
    internal let emotions: [String]?
    internal let entrySummary: String?
    internal let entryUuid: UUID
    internal let errorCode: String?
    internal let id: Int64
    internal let keywords: [String]?
    internal let localDate: String
    internal let promptVersion: String?
    internal let recordedAt: String
    internal let source: String
    internal let status: String
    internal let timezone: String
    internal let title: String?
    internal let transcribedAt: String?
    internal let transcript: String?
    internal let transcriptEdited: String?
    internal let transcriptLanguage: String?
    internal let transcriptRaw: String?
    internal let transcriptionModel: String?
    internal let transcriptionProvider: String?
    internal let updatedAt: String
    internal let uploadedAt: String?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case analysis = "analysis"
      case analysisModel = "analysis_model"
      case analysisProvider = "analysis_provider"
      case analyzedAt = "analyzed_at"
      case attemptCount = "attempt_count"
      case audioBytes = "audio_bytes"
      case audioDeletedAt = "audio_deleted_at"
      case audioMime = "audio_mime"
      case audioPath = "audio_path"
      case contentVersion = "content_version"
      case createdAt = "created_at"
      case deletedAt = "deleted_at"
      case durationMs = "duration_ms"
      case emotions = "emotions"
      case entrySummary = "entry_summary"
      case entryUuid = "entry_uuid"
      case errorCode = "error_code"
      case id = "id"
      case keywords = "keywords"
      case localDate = "local_date"
      case promptVersion = "prompt_version"
      case recordedAt = "recorded_at"
      case source = "source"
      case status = "status"
      case timezone = "timezone"
      case title = "title"
      case transcribedAt = "transcribed_at"
      case transcript = "transcript"
      case transcriptEdited = "transcript_edited"
      case transcriptLanguage = "transcript_language"
      case transcriptRaw = "transcript_raw"
      case transcriptionModel = "transcription_model"
      case transcriptionProvider = "transcription_provider"
      case updatedAt = "updated_at"
      case uploadedAt = "uploaded_at"
      case userId = "user_id"
    }
  }
  internal struct DiaryEntriesInsert: Codable, Hashable, Sendable {
    internal let analysis: AnyJSON?
    internal let analysisModel: String?
    internal let analysisProvider: String?
    internal let analyzedAt: String?
    internal let attemptCount: Int32?
    internal let audioBytes: Int64?
    internal let audioDeletedAt: String?
    internal let audioMime: String?
    internal let audioPath: String?
    internal let contentVersion: Int32?
    internal let createdAt: String?
    internal let deletedAt: String?
    internal let durationMs: Int32?
    internal let emotions: [String]?
    internal let entrySummary: String?
    internal let entryUuid: UUID?
    internal let errorCode: String?
    internal let id: Int64?
    internal let keywords: [String]?
    internal let localDate: String
    internal let promptVersion: String?
    internal let recordedAt: String?
    internal let source: String?
    internal let status: String?
    internal let timezone: String?
    internal let title: String?
    internal let transcribedAt: String?
    internal let transcript: String?
    internal let transcriptEdited: String?
    internal let transcriptLanguage: String?
    internal let transcriptRaw: String?
    internal let transcriptionModel: String?
    internal let transcriptionProvider: String?
    internal let updatedAt: String?
    internal let uploadedAt: String?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case analysis = "analysis"
      case analysisModel = "analysis_model"
      case analysisProvider = "analysis_provider"
      case analyzedAt = "analyzed_at"
      case attemptCount = "attempt_count"
      case audioBytes = "audio_bytes"
      case audioDeletedAt = "audio_deleted_at"
      case audioMime = "audio_mime"
      case audioPath = "audio_path"
      case contentVersion = "content_version"
      case createdAt = "created_at"
      case deletedAt = "deleted_at"
      case durationMs = "duration_ms"
      case emotions = "emotions"
      case entrySummary = "entry_summary"
      case entryUuid = "entry_uuid"
      case errorCode = "error_code"
      case id = "id"
      case keywords = "keywords"
      case localDate = "local_date"
      case promptVersion = "prompt_version"
      case recordedAt = "recorded_at"
      case source = "source"
      case status = "status"
      case timezone = "timezone"
      case title = "title"
      case transcribedAt = "transcribed_at"
      case transcript = "transcript"
      case transcriptEdited = "transcript_edited"
      case transcriptLanguage = "transcript_language"
      case transcriptRaw = "transcript_raw"
      case transcriptionModel = "transcription_model"
      case transcriptionProvider = "transcription_provider"
      case updatedAt = "updated_at"
      case uploadedAt = "uploaded_at"
      case userId = "user_id"
    }
  }
  internal struct DiaryEntriesUpdate: Codable, Hashable, Sendable {
    internal let analysis: AnyJSON?
    internal let analysisModel: String?
    internal let analysisProvider: String?
    internal let analyzedAt: String?
    internal let attemptCount: Int32?
    internal let audioBytes: Int64?
    internal let audioDeletedAt: String?
    internal let audioMime: String?
    internal let audioPath: String?
    internal let contentVersion: Int32?
    internal let createdAt: String?
    internal let deletedAt: String?
    internal let durationMs: Int32?
    internal let emotions: [String]?
    internal let entrySummary: String?
    internal let entryUuid: UUID?
    internal let errorCode: String?
    internal let id: Int64?
    internal let keywords: [String]?
    internal let localDate: String?
    internal let promptVersion: String?
    internal let recordedAt: String?
    internal let source: String?
    internal let status: String?
    internal let timezone: String?
    internal let title: String?
    internal let transcribedAt: String?
    internal let transcript: String?
    internal let transcriptEdited: String?
    internal let transcriptLanguage: String?
    internal let transcriptRaw: String?
    internal let transcriptionModel: String?
    internal let transcriptionProvider: String?
    internal let updatedAt: String?
    internal let uploadedAt: String?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case analysis = "analysis"
      case analysisModel = "analysis_model"
      case analysisProvider = "analysis_provider"
      case analyzedAt = "analyzed_at"
      case attemptCount = "attempt_count"
      case audioBytes = "audio_bytes"
      case audioDeletedAt = "audio_deleted_at"
      case audioMime = "audio_mime"
      case audioPath = "audio_path"
      case contentVersion = "content_version"
      case createdAt = "created_at"
      case deletedAt = "deleted_at"
      case durationMs = "duration_ms"
      case emotions = "emotions"
      case entrySummary = "entry_summary"
      case entryUuid = "entry_uuid"
      case errorCode = "error_code"
      case id = "id"
      case keywords = "keywords"
      case localDate = "local_date"
      case promptVersion = "prompt_version"
      case recordedAt = "recorded_at"
      case source = "source"
      case status = "status"
      case timezone = "timezone"
      case title = "title"
      case transcribedAt = "transcribed_at"
      case transcript = "transcript"
      case transcriptEdited = "transcript_edited"
      case transcriptLanguage = "transcript_language"
      case transcriptRaw = "transcript_raw"
      case transcriptionModel = "transcription_model"
      case transcriptionProvider = "transcription_provider"
      case updatedAt = "updated_at"
      case uploadedAt = "uploaded_at"
      case userId = "user_id"
    }
  }
  internal struct DiarySummariesSelect: Codable, Hashable, Sendable {
    internal let activeDayCount: Int32
    internal let attemptCount: Int32
    internal let createdAt: String
    internal let dataCutoffAt: String?
    internal let entryCount: Int32
    internal let errorCode: String?
    internal let generatedAt: String?
    internal let id: UUID
    internal let model: String?
    internal let periodStart: String
    internal let periodType: String
    internal let promptVersion: String?
    internal let provider: String?
    internal let schemaVersion: Int32
    internal let sourceFingerprint: String?
    internal let status: String
    internal let summary: AnyJSON
    internal let totalDurationMs: Int64
    internal let updatedAt: String
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case activeDayCount = "active_day_count"
      case attemptCount = "attempt_count"
      case createdAt = "created_at"
      case dataCutoffAt = "data_cutoff_at"
      case entryCount = "entry_count"
      case errorCode = "error_code"
      case generatedAt = "generated_at"
      case id = "id"
      case model = "model"
      case periodStart = "period_start"
      case periodType = "period_type"
      case promptVersion = "prompt_version"
      case provider = "provider"
      case schemaVersion = "schema_version"
      case sourceFingerprint = "source_fingerprint"
      case status = "status"
      case summary = "summary"
      case totalDurationMs = "total_duration_ms"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct DiarySummariesInsert: Codable, Hashable, Sendable {
    internal let activeDayCount: Int32?
    internal let attemptCount: Int32?
    internal let createdAt: String?
    internal let dataCutoffAt: String?
    internal let entryCount: Int32?
    internal let errorCode: String?
    internal let generatedAt: String?
    internal let id: UUID?
    internal let model: String?
    internal let periodStart: String
    internal let periodType: String
    internal let promptVersion: String?
    internal let provider: String?
    internal let schemaVersion: Int32?
    internal let sourceFingerprint: String?
    internal let status: String?
    internal let summary: AnyJSON?
    internal let totalDurationMs: Int64?
    internal let updatedAt: String?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case activeDayCount = "active_day_count"
      case attemptCount = "attempt_count"
      case createdAt = "created_at"
      case dataCutoffAt = "data_cutoff_at"
      case entryCount = "entry_count"
      case errorCode = "error_code"
      case generatedAt = "generated_at"
      case id = "id"
      case model = "model"
      case periodStart = "period_start"
      case periodType = "period_type"
      case promptVersion = "prompt_version"
      case provider = "provider"
      case schemaVersion = "schema_version"
      case sourceFingerprint = "source_fingerprint"
      case status = "status"
      case summary = "summary"
      case totalDurationMs = "total_duration_ms"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct DiarySummariesUpdate: Codable, Hashable, Sendable {
    internal let activeDayCount: Int32?
    internal let attemptCount: Int32?
    internal let createdAt: String?
    internal let dataCutoffAt: String?
    internal let entryCount: Int32?
    internal let errorCode: String?
    internal let generatedAt: String?
    internal let id: UUID?
    internal let model: String?
    internal let periodStart: String?
    internal let periodType: String?
    internal let promptVersion: String?
    internal let provider: String?
    internal let schemaVersion: Int32?
    internal let sourceFingerprint: String?
    internal let status: String?
    internal let summary: AnyJSON?
    internal let totalDurationMs: Int64?
    internal let updatedAt: String?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case activeDayCount = "active_day_count"
      case attemptCount = "attempt_count"
      case createdAt = "created_at"
      case dataCutoffAt = "data_cutoff_at"
      case entryCount = "entry_count"
      case errorCode = "error_code"
      case generatedAt = "generated_at"
      case id = "id"
      case model = "model"
      case periodStart = "period_start"
      case periodType = "period_type"
      case promptVersion = "prompt_version"
      case provider = "provider"
      case schemaVersion = "schema_version"
      case sourceFingerprint = "source_fingerprint"
      case status = "status"
      case summary = "summary"
      case totalDurationMs = "total_duration_ms"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct DiarySummaryCacheSelect: Codable, Hashable, Sendable {
    internal let entryCount: Int32
    internal let period: String
    internal let ref: String
    internal let summary: AnyJSON
    internal let updatedAt: String
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case entryCount = "entry_count"
      case period = "period"
      case ref = "ref"
      case summary = "summary"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct DiarySummaryCacheInsert: Codable, Hashable, Sendable {
    internal let entryCount: Int32?
    internal let period: String
    internal let ref: String
    internal let summary: AnyJSON?
    internal let updatedAt: String?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case entryCount = "entry_count"
      case period = "period"
      case ref = "ref"
      case summary = "summary"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct DiarySummaryCacheUpdate: Codable, Hashable, Sendable {
    internal let entryCount: Int32?
    internal let period: String?
    internal let ref: String?
    internal let summary: AnyJSON?
    internal let updatedAt: String?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case entryCount = "entry_count"
      case period = "period"
      case ref = "ref"
      case summary = "summary"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct KaleidoscopeDrawsSelect: Codable, Hashable, Sendable {
    internal let createdAt: String
    internal let id: Int64
    internal let mode: String
    internal let travelerId: Int64?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case id = "id"
      case mode = "mode"
      case travelerId = "traveler_id"
      case userId = "user_id"
    }
  }
  internal struct KaleidoscopeDrawsInsert: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let id: Int64?
    internal let mode: String
    internal let travelerId: Int64?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case id = "id"
      case mode = "mode"
      case travelerId = "traveler_id"
      case userId = "user_id"
    }
  }
  internal struct KaleidoscopeDrawsUpdate: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let id: Int64?
    internal let mode: String?
    internal let travelerId: Int64?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case id = "id"
      case mode = "mode"
      case travelerId = "traveler_id"
      case userId = "user_id"
    }
  }
  internal struct LabChoiceSetsSelect: Codable, Hashable, Sendable {
    internal let cards: AnyJSON
    internal let constraints: [String]
    internal let createdAt: String
    internal let id: Int64
    internal let previousChoices: [String]
    internal let question: String
    internal let rationale: String
    internal let topic: String?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case cards = "cards"
      case constraints = "constraints"
      case createdAt = "created_at"
      case id = "id"
      case previousChoices = "previous_choices"
      case question = "question"
      case rationale = "rationale"
      case topic = "topic"
      case userId = "user_id"
    }
  }
  internal struct LabChoiceSetsInsert: Codable, Hashable, Sendable {
    internal let cards: AnyJSON
    internal let constraints: [String]?
    internal let createdAt: String?
    internal let id: Int64?
    internal let previousChoices: [String]?
    internal let question: String
    internal let rationale: String?
    internal let topic: String?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case cards = "cards"
      case constraints = "constraints"
      case createdAt = "created_at"
      case id = "id"
      case previousChoices = "previous_choices"
      case question = "question"
      case rationale = "rationale"
      case topic = "topic"
      case userId = "user_id"
    }
  }
  internal struct LabChoiceSetsUpdate: Codable, Hashable, Sendable {
    internal let cards: AnyJSON?
    internal let constraints: [String]?
    internal let createdAt: String?
    internal let id: Int64?
    internal let previousChoices: [String]?
    internal let question: String?
    internal let rationale: String?
    internal let topic: String?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case cards = "cards"
      case constraints = "constraints"
      case createdAt = "created_at"
      case id = "id"
      case previousChoices = "previous_choices"
      case question = "question"
      case rationale = "rationale"
      case topic = "topic"
      case userId = "user_id"
    }
  }
  internal struct MatchResultsSelect: Codable, Hashable, Sendable {
    internal let createdAt: String
    internal let id: Int64
    internal let matches: AnyJSON
    internal let userId: UUID
    internal let userState: AnyJSON
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case id = "id"
      case matches = "matches"
      case userId = "user_id"
      case userState = "user_state"
    }
  }
  internal struct MatchResultsInsert: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let id: Int64?
    internal let matches: AnyJSON
    internal let userId: UUID
    internal let userState: AnyJSON
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case id = "id"
      case matches = "matches"
      case userId = "user_id"
      case userState = "user_state"
    }
  }
  internal struct MatchResultsUpdate: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let id: Int64?
    internal let matches: AnyJSON?
    internal let userId: UUID?
    internal let userState: AnyJSON?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case id = "id"
      case matches = "matches"
      case userId = "user_id"
      case userState = "user_state"
    }
  }
  internal struct MemoryProposalsSelect: Codable, Hashable, Sendable {
    internal let confidence: Decimal
    internal let createdAt: String
    internal let dedupeKey: String
    internal let dimension: String
    internal let expiresAt: String
    internal let factKind: String
    internal let id: UUID
    internal let modelName: String?
    internal let normalizedValue: String
    internal let operation: String
    internal let promptVersion: String?
    internal let rationaleCode: String
    internal let reviewedAt: String?
    internal let schemaVersion: Int32
    internal let sensitivity: String
    internal let sourceId: String
    internal let sourceType: String
    internal let sourceVersion: Int32
    internal let status: String
    internal let targetFactId: UUID?
    internal let userId: UUID
    internal let value: String
    internal enum CodingKeys: String, CodingKey {
      case confidence = "confidence"
      case createdAt = "created_at"
      case dedupeKey = "dedupe_key"
      case dimension = "dimension"
      case expiresAt = "expires_at"
      case factKind = "fact_kind"
      case id = "id"
      case modelName = "model_name"
      case normalizedValue = "normalized_value"
      case operation = "operation"
      case promptVersion = "prompt_version"
      case rationaleCode = "rationale_code"
      case reviewedAt = "reviewed_at"
      case schemaVersion = "schema_version"
      case sensitivity = "sensitivity"
      case sourceId = "source_id"
      case sourceType = "source_type"
      case sourceVersion = "source_version"
      case status = "status"
      case targetFactId = "target_fact_id"
      case userId = "user_id"
      case value = "value"
    }
  }
  internal struct MemoryProposalsInsert: Codable, Hashable, Sendable {
    internal let confidence: Decimal
    internal let createdAt: String?
    internal let dedupeKey: String
    internal let dimension: String
    internal let expiresAt: String?
    internal let factKind: String?
    internal let id: UUID?
    internal let modelName: String?
    internal let normalizedValue: String
    internal let operation: String?
    internal let promptVersion: String?
    internal let rationaleCode: String?
    internal let reviewedAt: String?
    internal let schemaVersion: Int32?
    internal let sensitivity: String?
    internal let sourceId: String
    internal let sourceType: String
    internal let sourceVersion: Int32?
    internal let status: String?
    internal let targetFactId: UUID?
    internal let userId: UUID
    internal let value: String
    internal enum CodingKeys: String, CodingKey {
      case confidence = "confidence"
      case createdAt = "created_at"
      case dedupeKey = "dedupe_key"
      case dimension = "dimension"
      case expiresAt = "expires_at"
      case factKind = "fact_kind"
      case id = "id"
      case modelName = "model_name"
      case normalizedValue = "normalized_value"
      case operation = "operation"
      case promptVersion = "prompt_version"
      case rationaleCode = "rationale_code"
      case reviewedAt = "reviewed_at"
      case schemaVersion = "schema_version"
      case sensitivity = "sensitivity"
      case sourceId = "source_id"
      case sourceType = "source_type"
      case sourceVersion = "source_version"
      case status = "status"
      case targetFactId = "target_fact_id"
      case userId = "user_id"
      case value = "value"
    }
  }
  internal struct MemoryProposalsUpdate: Codable, Hashable, Sendable {
    internal let confidence: Decimal?
    internal let createdAt: String?
    internal let dedupeKey: String?
    internal let dimension: String?
    internal let expiresAt: String?
    internal let factKind: String?
    internal let id: UUID?
    internal let modelName: String?
    internal let normalizedValue: String?
    internal let operation: String?
    internal let promptVersion: String?
    internal let rationaleCode: String?
    internal let reviewedAt: String?
    internal let schemaVersion: Int32?
    internal let sensitivity: String?
    internal let sourceId: String?
    internal let sourceType: String?
    internal let sourceVersion: Int32?
    internal let status: String?
    internal let targetFactId: UUID?
    internal let userId: UUID?
    internal let value: String?
    internal enum CodingKeys: String, CodingKey {
      case confidence = "confidence"
      case createdAt = "created_at"
      case dedupeKey = "dedupe_key"
      case dimension = "dimension"
      case expiresAt = "expires_at"
      case factKind = "fact_kind"
      case id = "id"
      case modelName = "model_name"
      case normalizedValue = "normalized_value"
      case operation = "operation"
      case promptVersion = "prompt_version"
      case rationaleCode = "rationale_code"
      case reviewedAt = "reviewed_at"
      case schemaVersion = "schema_version"
      case sensitivity = "sensitivity"
      case sourceId = "source_id"
      case sourceType = "source_type"
      case sourceVersion = "source_version"
      case status = "status"
      case targetFactId = "target_fact_id"
      case userId = "user_id"
      case value = "value"
    }
  }
  internal struct MessagesSelect: Codable, Hashable, Sendable {
    internal let content: String
    internal let conversationId: UUID
    internal let createdAt: String
    internal let id: Int64
    internal let meta: AnyJSON?
    internal let role: String
    internal enum CodingKeys: String, CodingKey {
      case content = "content"
      case conversationId = "conversation_id"
      case createdAt = "created_at"
      case id = "id"
      case meta = "meta"
      case role = "role"
    }
  }
  internal struct MessagesInsert: Codable, Hashable, Sendable {
    internal let content: String
    internal let conversationId: UUID
    internal let createdAt: String?
    internal let id: Int64?
    internal let meta: AnyJSON?
    internal let role: String
    internal enum CodingKeys: String, CodingKey {
      case content = "content"
      case conversationId = "conversation_id"
      case createdAt = "created_at"
      case id = "id"
      case meta = "meta"
      case role = "role"
    }
  }
  internal struct MessagesUpdate: Codable, Hashable, Sendable {
    internal let content: String?
    internal let conversationId: UUID?
    internal let createdAt: String?
    internal let id: Int64?
    internal let meta: AnyJSON?
    internal let role: String?
    internal enum CodingKeys: String, CodingKey {
      case content = "content"
      case conversationId = "conversation_id"
      case createdAt = "created_at"
      case id = "id"
      case meta = "meta"
      case role = "role"
    }
  }
  internal struct PersonaJobsSelect: Codable, Hashable, Sendable {
    internal let createdAt: String
    internal let error: String?
    internal let id: UUID
    internal let modelVersion: String
    internal let persona: AnyJSON
    internal let status: String
    internal let updatedAt: String
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case error = "error"
      case id = "id"
      case modelVersion = "model_version"
      case persona = "persona"
      case status = "status"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct PersonaJobsInsert: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let error: String?
    internal let id: UUID?
    internal let modelVersion: String?
    internal let persona: AnyJSON?
    internal let status: String?
    internal let updatedAt: String?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case error = "error"
      case id = "id"
      case modelVersion = "model_version"
      case persona = "persona"
      case status = "status"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct PersonaJobsUpdate: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let error: String?
    internal let id: UUID?
    internal let modelVersion: String?
    internal let persona: AnyJSON?
    internal let status: String?
    internal let updatedAt: String?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case error = "error"
      case id = "id"
      case modelVersion = "model_version"
      case persona = "persona"
      case status = "status"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct ProfileFactEvidenceSelect: Codable, Hashable, Sendable {
    internal let confidence: Decimal
    internal let createdAt: String
    internal let evidenceRole: String
    internal let factId: UUID
    internal let id: UUID
    internal let observedAt: String
    internal let sourceId: String
    internal let sourceType: String
    internal let sourceVersion: Int32
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case confidence = "confidence"
      case createdAt = "created_at"
      case evidenceRole = "evidence_role"
      case factId = "fact_id"
      case id = "id"
      case observedAt = "observed_at"
      case sourceId = "source_id"
      case sourceType = "source_type"
      case sourceVersion = "source_version"
      case userId = "user_id"
    }
  }
  internal struct ProfileFactEvidenceInsert: Codable, Hashable, Sendable {
    internal let confidence: Decimal?
    internal let createdAt: String?
    internal let evidenceRole: String?
    internal let factId: UUID
    internal let id: UUID?
    internal let observedAt: String?
    internal let sourceId: String
    internal let sourceType: String
    internal let sourceVersion: Int32?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case confidence = "confidence"
      case createdAt = "created_at"
      case evidenceRole = "evidence_role"
      case factId = "fact_id"
      case id = "id"
      case observedAt = "observed_at"
      case sourceId = "source_id"
      case sourceType = "source_type"
      case sourceVersion = "source_version"
      case userId = "user_id"
    }
  }
  internal struct ProfileFactEvidenceUpdate: Codable, Hashable, Sendable {
    internal let confidence: Decimal?
    internal let createdAt: String?
    internal let evidenceRole: String?
    internal let factId: UUID?
    internal let id: UUID?
    internal let observedAt: String?
    internal let sourceId: String?
    internal let sourceType: String?
    internal let sourceVersion: Int32?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case confidence = "confidence"
      case createdAt = "created_at"
      case evidenceRole = "evidence_role"
      case factId = "fact_id"
      case id = "id"
      case observedAt = "observed_at"
      case sourceId = "source_id"
      case sourceType = "source_type"
      case sourceVersion = "source_version"
      case userId = "user_id"
    }
  }
  internal struct ProfileFactsSelect: Codable, Hashable, Sendable {
    internal let confidence: Decimal
    internal let createdAt: String
    internal let dimension: String
    internal let factKind: String
    internal let id: UUID
    internal let lastSupportedAt: String
    internal let normalizedValue: String
    internal let observedAt: String
    internal let sensitivity: String
    internal let source: String
    internal let sourceRef: String?
    internal let status: String
    internal let supportCount: Int32
    internal let updatedAt: String
    internal let userConfirmed: Bool
    internal let userId: UUID
    internal let validFrom: String?
    internal let validTo: String?
    internal let value: String
    internal let visibility: String
    internal enum CodingKeys: String, CodingKey {
      case confidence = "confidence"
      case createdAt = "created_at"
      case dimension = "dimension"
      case factKind = "fact_kind"
      case id = "id"
      case lastSupportedAt = "last_supported_at"
      case normalizedValue = "normalized_value"
      case observedAt = "observed_at"
      case sensitivity = "sensitivity"
      case source = "source"
      case sourceRef = "source_ref"
      case status = "status"
      case supportCount = "support_count"
      case updatedAt = "updated_at"
      case userConfirmed = "user_confirmed"
      case userId = "user_id"
      case validFrom = "valid_from"
      case validTo = "valid_to"
      case value = "value"
      case visibility = "visibility"
    }
  }
  internal struct ProfileFactsInsert: Codable, Hashable, Sendable {
    internal let confidence: Decimal?
    internal let createdAt: String?
    internal let dimension: String
    internal let factKind: String?
    internal let id: UUID?
    internal let lastSupportedAt: String?
    internal let normalizedValue: String
    internal let observedAt: String?
    internal let sensitivity: String?
    internal let source: String?
    internal let sourceRef: String?
    internal let status: String?
    internal let supportCount: Int32?
    internal let updatedAt: String?
    internal let userConfirmed: Bool?
    internal let userId: UUID
    internal let validFrom: String?
    internal let validTo: String?
    internal let value: String
    internal let visibility: String?
    internal enum CodingKeys: String, CodingKey {
      case confidence = "confidence"
      case createdAt = "created_at"
      case dimension = "dimension"
      case factKind = "fact_kind"
      case id = "id"
      case lastSupportedAt = "last_supported_at"
      case normalizedValue = "normalized_value"
      case observedAt = "observed_at"
      case sensitivity = "sensitivity"
      case source = "source"
      case sourceRef = "source_ref"
      case status = "status"
      case supportCount = "support_count"
      case updatedAt = "updated_at"
      case userConfirmed = "user_confirmed"
      case userId = "user_id"
      case validFrom = "valid_from"
      case validTo = "valid_to"
      case value = "value"
      case visibility = "visibility"
    }
  }
  internal struct ProfileFactsUpdate: Codable, Hashable, Sendable {
    internal let confidence: Decimal?
    internal let createdAt: String?
    internal let dimension: String?
    internal let factKind: String?
    internal let id: UUID?
    internal let lastSupportedAt: String?
    internal let normalizedValue: String?
    internal let observedAt: String?
    internal let sensitivity: String?
    internal let source: String?
    internal let sourceRef: String?
    internal let status: String?
    internal let supportCount: Int32?
    internal let updatedAt: String?
    internal let userConfirmed: Bool?
    internal let userId: UUID?
    internal let validFrom: String?
    internal let validTo: String?
    internal let value: String?
    internal let visibility: String?
    internal enum CodingKeys: String, CodingKey {
      case confidence = "confidence"
      case createdAt = "created_at"
      case dimension = "dimension"
      case factKind = "fact_kind"
      case id = "id"
      case lastSupportedAt = "last_supported_at"
      case normalizedValue = "normalized_value"
      case observedAt = "observed_at"
      case sensitivity = "sensitivity"
      case source = "source"
      case sourceRef = "source_ref"
      case status = "status"
      case supportCount = "support_count"
      case updatedAt = "updated_at"
      case userConfirmed = "user_confirmed"
      case userId = "user_id"
      case validFrom = "valid_from"
      case validTo = "valid_to"
      case value = "value"
      case visibility = "visibility"
    }
  }
  internal struct ProfilePublicDraftsSelect: Codable, Hashable, Sendable {
    internal let advice: AnyJSON
    internal let age: Int16?
    internal let avatarUrl: String?
    internal let bio: String
    internal let city: String
    internal let createdAt: String
    internal let fromRole: String
    internal let hue: Int16
    internal let id: UUID
    internal let name: String
    internal let profileVersion: Int16
    internal let quote: String
    internal let result: String
    internal let services: AnyJSON
    internal let stage: String
    internal let storyFull: String
    internal let storyIntro: String
    internal let tags: [String]
    internal let toRole: String
    internal let trajectory: AnyJSON
    internal let updatedAt: String
    internal enum CodingKeys: String, CodingKey {
      case advice = "advice"
      case age = "age"
      case avatarUrl = "avatar_url"
      case bio = "bio"
      case city = "city"
      case createdAt = "created_at"
      case fromRole = "from_role"
      case hue = "hue"
      case id = "id"
      case name = "name"
      case profileVersion = "profile_version"
      case quote = "quote"
      case result = "result"
      case services = "services"
      case stage = "stage"
      case storyFull = "story_full"
      case storyIntro = "story_intro"
      case tags = "tags"
      case toRole = "to_role"
      case trajectory = "trajectory"
      case updatedAt = "updated_at"
    }
  }
  internal struct ProfilePublicDraftsInsert: Codable, Hashable, Sendable {
    internal let advice: AnyJSON?
    internal let age: Int16?
    internal let avatarUrl: String?
    internal let bio: String?
    internal let city: String?
    internal let createdAt: String?
    internal let fromRole: String?
    internal let hue: Int16?
    internal let id: UUID
    internal let name: String?
    internal let profileVersion: Int16?
    internal let quote: String?
    internal let result: String?
    internal let services: AnyJSON?
    internal let stage: String?
    internal let storyFull: String?
    internal let storyIntro: String?
    internal let tags: [String]?
    internal let toRole: String?
    internal let trajectory: AnyJSON?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case advice = "advice"
      case age = "age"
      case avatarUrl = "avatar_url"
      case bio = "bio"
      case city = "city"
      case createdAt = "created_at"
      case fromRole = "from_role"
      case hue = "hue"
      case id = "id"
      case name = "name"
      case profileVersion = "profile_version"
      case quote = "quote"
      case result = "result"
      case services = "services"
      case stage = "stage"
      case storyFull = "story_full"
      case storyIntro = "story_intro"
      case tags = "tags"
      case toRole = "to_role"
      case trajectory = "trajectory"
      case updatedAt = "updated_at"
    }
  }
  internal struct ProfilePublicDraftsUpdate: Codable, Hashable, Sendable {
    internal let advice: AnyJSON?
    internal let age: Int16?
    internal let avatarUrl: String?
    internal let bio: String?
    internal let city: String?
    internal let createdAt: String?
    internal let fromRole: String?
    internal let hue: Int16?
    internal let id: UUID?
    internal let name: String?
    internal let profileVersion: Int16?
    internal let quote: String?
    internal let result: String?
    internal let services: AnyJSON?
    internal let stage: String?
    internal let storyFull: String?
    internal let storyIntro: String?
    internal let tags: [String]?
    internal let toRole: String?
    internal let trajectory: AnyJSON?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case advice = "advice"
      case age = "age"
      case avatarUrl = "avatar_url"
      case bio = "bio"
      case city = "city"
      case createdAt = "created_at"
      case fromRole = "from_role"
      case hue = "hue"
      case id = "id"
      case name = "name"
      case profileVersion = "profile_version"
      case quote = "quote"
      case result = "result"
      case services = "services"
      case stage = "stage"
      case storyFull = "story_full"
      case storyIntro = "story_intro"
      case tags = "tags"
      case toRole = "to_role"
      case trajectory = "trajectory"
      case updatedAt = "updated_at"
    }
  }
  internal struct ProfilesSelect: Codable, Hashable, Sendable {
    internal let createdAt: String
    internal let id: UUID
    internal let portraitPct: Int16
    internal let profileRevision: Int64
    internal let updatedAt: String
    internal let verificationProvider: String?
    internal let verificationStatus: String
    internal let verifiedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case id = "id"
      case portraitPct = "portrait_pct"
      case profileRevision = "profile_revision"
      case updatedAt = "updated_at"
      case verificationProvider = "verification_provider"
      case verificationStatus = "verification_status"
      case verifiedAt = "verified_at"
    }
  }
  internal struct ProfilesInsert: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let id: UUID
    internal let portraitPct: Int16?
    internal let profileRevision: Int64?
    internal let updatedAt: String?
    internal let verificationProvider: String?
    internal let verificationStatus: String?
    internal let verifiedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case id = "id"
      case portraitPct = "portrait_pct"
      case profileRevision = "profile_revision"
      case updatedAt = "updated_at"
      case verificationProvider = "verification_provider"
      case verificationStatus = "verification_status"
      case verifiedAt = "verified_at"
    }
  }
  internal struct ProfilesUpdate: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let id: UUID?
    internal let portraitPct: Int16?
    internal let profileRevision: Int64?
    internal let updatedAt: String?
    internal let verificationProvider: String?
    internal let verificationStatus: String?
    internal let verifiedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case id = "id"
      case portraitPct = "portrait_pct"
      case profileRevision = "profile_revision"
      case updatedAt = "updated_at"
      case verificationProvider = "verification_provider"
      case verificationStatus = "verification_status"
      case verifiedAt = "verified_at"
    }
  }
  internal struct PublicProfilesSelect: Codable, Hashable, Sendable {
    internal let avatarUrl: String?
    internal let bio: String
    internal let hue: Int16
    internal let id: UUID
    internal let isVerified: Bool
    internal let name: String
    internal let publishedAt: String
    internal let publishedFacts: AnyJSON
    internal let quote: String
    internal let tags: [String]
    internal let updatedAt: String
    internal enum CodingKeys: String, CodingKey {
      case avatarUrl = "avatar_url"
      case bio = "bio"
      case hue = "hue"
      case id = "id"
      case isVerified = "is_verified"
      case name = "name"
      case publishedAt = "published_at"
      case publishedFacts = "published_facts"
      case quote = "quote"
      case tags = "tags"
      case updatedAt = "updated_at"
    }
  }
  internal struct PublicProfilesInsert: Codable, Hashable, Sendable {
    internal let avatarUrl: String?
    internal let bio: String?
    internal let hue: Int16?
    internal let id: UUID
    internal let isVerified: Bool?
    internal let name: String?
    internal let publishedAt: String?
    internal let publishedFacts: AnyJSON?
    internal let quote: String?
    internal let tags: [String]?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case avatarUrl = "avatar_url"
      case bio = "bio"
      case hue = "hue"
      case id = "id"
      case isVerified = "is_verified"
      case name = "name"
      case publishedAt = "published_at"
      case publishedFacts = "published_facts"
      case quote = "quote"
      case tags = "tags"
      case updatedAt = "updated_at"
    }
  }
  internal struct PublicProfilesUpdate: Codable, Hashable, Sendable {
    internal let avatarUrl: String?
    internal let bio: String?
    internal let hue: Int16?
    internal let id: UUID?
    internal let isVerified: Bool?
    internal let name: String?
    internal let publishedAt: String?
    internal let publishedFacts: AnyJSON?
    internal let quote: String?
    internal let tags: [String]?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case avatarUrl = "avatar_url"
      case bio = "bio"
      case hue = "hue"
      case id = "id"
      case isVerified = "is_verified"
      case name = "name"
      case publishedAt = "published_at"
      case publishedFacts = "published_facts"
      case quote = "quote"
      case tags = "tags"
      case updatedAt = "updated_at"
    }
  }
  internal struct SimulationsSelect: Codable, Hashable, Sendable {
    internal let bottomLine: AnyJSON
    internal let carryCards: [String]
    internal let choice: String
    internal let createdAt: String
    internal let id: Int64
    internal let question: String
    internal let scenarios: AnyJSON
    internal let timeHorizon: String
    internal let userId: UUID
    internal let years: Int32
    internal enum CodingKeys: String, CodingKey {
      case bottomLine = "bottom_line"
      case carryCards = "carry_cards"
      case choice = "choice"
      case createdAt = "created_at"
      case id = "id"
      case question = "question"
      case scenarios = "scenarios"
      case timeHorizon = "time_horizon"
      case userId = "user_id"
      case years = "years"
    }
  }
  internal struct SimulationsInsert: Codable, Hashable, Sendable {
    internal let bottomLine: AnyJSON?
    internal let carryCards: [String]?
    internal let choice: String
    internal let createdAt: String?
    internal let id: Int64?
    internal let question: String
    internal let scenarios: AnyJSON
    internal let timeHorizon: String?
    internal let userId: UUID
    internal let years: Int32
    internal enum CodingKeys: String, CodingKey {
      case bottomLine = "bottom_line"
      case carryCards = "carry_cards"
      case choice = "choice"
      case createdAt = "created_at"
      case id = "id"
      case question = "question"
      case scenarios = "scenarios"
      case timeHorizon = "time_horizon"
      case userId = "user_id"
      case years = "years"
    }
  }
  internal struct SimulationsUpdate: Codable, Hashable, Sendable {
    internal let bottomLine: AnyJSON?
    internal let carryCards: [String]?
    internal let choice: String?
    internal let createdAt: String?
    internal let id: Int64?
    internal let question: String?
    internal let scenarios: AnyJSON?
    internal let timeHorizon: String?
    internal let userId: UUID?
    internal let years: Int32?
    internal enum CodingKeys: String, CodingKey {
      case bottomLine = "bottom_line"
      case carryCards = "carry_cards"
      case choice = "choice"
      case createdAt = "created_at"
      case id = "id"
      case question = "question"
      case scenarios = "scenarios"
      case timeHorizon = "time_horizon"
      case userId = "user_id"
      case years = "years"
    }
  }
  internal struct TravelerDetailsSelect: Codable, Hashable, Sendable {
    internal let advice: AnyJSON
    internal let age: Int32?
    internal let city: String?
    internal let consulted: Int32?
    internal let fromRole: String?
    internal let fullText: String
    internal let intro: String
    internal let responseTime: String?
    internal let result: String?
    internal let toRole: String?
    internal let travelerId: Int64
    internal let years: String?
    internal enum CodingKeys: String, CodingKey {
      case advice = "advice"
      case age = "age"
      case city = "city"
      case consulted = "consulted"
      case fromRole = "from_role"
      case fullText = "full_text"
      case intro = "intro"
      case responseTime = "response_time"
      case result = "result"
      case toRole = "to_role"
      case travelerId = "traveler_id"
      case years = "years"
    }
  }
  internal struct TravelerDetailsInsert: Codable, Hashable, Sendable {
    internal let advice: AnyJSON?
    internal let age: Int32?
    internal let city: String?
    internal let consulted: Int32?
    internal let fromRole: String?
    internal let fullText: String
    internal let intro: String
    internal let responseTime: String?
    internal let result: String?
    internal let toRole: String?
    internal let travelerId: Int64
    internal let years: String?
    internal enum CodingKeys: String, CodingKey {
      case advice = "advice"
      case age = "age"
      case city = "city"
      case consulted = "consulted"
      case fromRole = "from_role"
      case fullText = "full_text"
      case intro = "intro"
      case responseTime = "response_time"
      case result = "result"
      case toRole = "to_role"
      case travelerId = "traveler_id"
      case years = "years"
    }
  }
  internal struct TravelerDetailsUpdate: Codable, Hashable, Sendable {
    internal let advice: AnyJSON?
    internal let age: Int32?
    internal let city: String?
    internal let consulted: Int32?
    internal let fromRole: String?
    internal let fullText: String?
    internal let intro: String?
    internal let responseTime: String?
    internal let result: String?
    internal let toRole: String?
    internal let travelerId: Int64?
    internal let years: String?
    internal enum CodingKeys: String, CodingKey {
      case advice = "advice"
      case age = "age"
      case city = "city"
      case consulted = "consulted"
      case fromRole = "from_role"
      case fullText = "full_text"
      case intro = "intro"
      case responseTime = "response_time"
      case result = "result"
      case toRole = "to_role"
      case travelerId = "traveler_id"
      case years = "years"
    }
  }
  internal struct TravelerServicesSelect: Codable, Hashable, Sendable {
    internal let description: String
    internal let id: String
    internal let kind: String
    internal let price: Decimal
    internal let tags: [String]
    internal let title: String
    internal let travelerId: Int64?
    internal let unit: String
    internal enum CodingKeys: String, CodingKey {
      case description = "description"
      case id = "id"
      case kind = "kind"
      case price = "price"
      case tags = "tags"
      case title = "title"
      case travelerId = "traveler_id"
      case unit = "unit"
    }
  }
  internal struct TravelerServicesInsert: Codable, Hashable, Sendable {
    internal let description: String
    internal let id: String
    internal let kind: String
    internal let price: Decimal
    internal let tags: [String]?
    internal let title: String
    internal let travelerId: Int64?
    internal let unit: String?
    internal enum CodingKeys: String, CodingKey {
      case description = "description"
      case id = "id"
      case kind = "kind"
      case price = "price"
      case tags = "tags"
      case title = "title"
      case travelerId = "traveler_id"
      case unit = "unit"
    }
  }
  internal struct TravelerServicesUpdate: Codable, Hashable, Sendable {
    internal let description: String?
    internal let id: String?
    internal let kind: String?
    internal let price: Decimal?
    internal let tags: [String]?
    internal let title: String?
    internal let travelerId: Int64?
    internal let unit: String?
    internal enum CodingKeys: String, CodingKey {
      case description = "description"
      case id = "id"
      case kind = "kind"
      case price = "price"
      case tags = "tags"
      case title = "title"
      case travelerId = "traveler_id"
      case unit = "unit"
    }
  }
  internal struct TravelersSelect: Codable, Hashable, Sendable {
    internal let bio: String
    internal let createdAt: String
    internal let dims: AnyJSON
    internal let hue: Int16
    internal let id: Int64
    internal let initial: String
    internal let isSimilar: Bool
    internal let name: String
    internal let quote: String
    internal let tags: [String]
    internal let trajectory: AnyJSON
    internal enum CodingKeys: String, CodingKey {
      case bio = "bio"
      case createdAt = "created_at"
      case dims = "dims"
      case hue = "hue"
      case id = "id"
      case initial = "initial"
      case isSimilar = "is_similar"
      case name = "name"
      case quote = "quote"
      case tags = "tags"
      case trajectory = "trajectory"
    }
  }
  internal struct TravelersInsert: Codable, Hashable, Sendable {
    internal let bio: String
    internal let createdAt: String?
    internal let dims: AnyJSON?
    internal let hue: Int16
    internal let id: Int64
    internal let initial: String
    internal let isSimilar: Bool?
    internal let name: String
    internal let quote: String
    internal let tags: [String]?
    internal let trajectory: AnyJSON?
    internal enum CodingKeys: String, CodingKey {
      case bio = "bio"
      case createdAt = "created_at"
      case dims = "dims"
      case hue = "hue"
      case id = "id"
      case initial = "initial"
      case isSimilar = "is_similar"
      case name = "name"
      case quote = "quote"
      case tags = "tags"
      case trajectory = "trajectory"
    }
  }
  internal struct TravelersUpdate: Codable, Hashable, Sendable {
    internal let bio: String?
    internal let createdAt: String?
    internal let dims: AnyJSON?
    internal let hue: Int16?
    internal let id: Int64?
    internal let initial: String?
    internal let isSimilar: Bool?
    internal let name: String?
    internal let quote: String?
    internal let tags: [String]?
    internal let trajectory: AnyJSON?
    internal enum CodingKeys: String, CodingKey {
      case bio = "bio"
      case createdAt = "created_at"
      case dims = "dims"
      case hue = "hue"
      case id = "id"
      case initial = "initial"
      case isSimilar = "is_similar"
      case name = "name"
      case quote = "quote"
      case tags = "tags"
      case trajectory = "trajectory"
    }
  }
  internal struct UnlocksSelect: Codable, Hashable, Sendable {
    internal let amount: Decimal
    internal let createdAt: String
    internal let id: Int64
    internal let kind: String
    internal let targetId: String
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case amount = "amount"
      case createdAt = "created_at"
      case id = "id"
      case kind = "kind"
      case targetId = "target_id"
      case userId = "user_id"
    }
  }
  internal struct UnlocksInsert: Codable, Hashable, Sendable {
    internal let amount: Decimal
    internal let createdAt: String?
    internal let id: Int64?
    internal let kind: String
    internal let targetId: String
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case amount = "amount"
      case createdAt = "created_at"
      case id = "id"
      case kind = "kind"
      case targetId = "target_id"
      case userId = "user_id"
    }
  }
  internal struct UnlocksUpdate: Codable, Hashable, Sendable {
    internal let amount: Decimal?
    internal let createdAt: String?
    internal let id: Int64?
    internal let kind: String?
    internal let targetId: String?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case amount = "amount"
      case createdAt = "created_at"
      case id = "id"
      case kind = "kind"
      case targetId = "target_id"
      case userId = "user_id"
    }
  }
}
internal enum StorageSchema {
  internal enum Buckettype: String, Codable, Hashable, Sendable {
    case standard = "STANDARD"
    case analytics = "ANALYTICS"
    case vector = "VECTOR"
  }
  internal struct BucketsSelect: Codable, Hashable, Sendable {
    internal let allowedMimeTypes: [String]?
    internal let avifAutodetection: Bool?
    internal let createdAt: String?
    internal let fileSizeLimit: Int64?
    internal let id: String
    internal let name: String
    internal let owner: UUID?
    internal let ownerId: String?
    internal let public: Bool?
    internal let type: Buckettype
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case allowedMimeTypes = "allowed_mime_types"
      case avifAutodetection = "avif_autodetection"
      case createdAt = "created_at"
      case fileSizeLimit = "file_size_limit"
      case id = "id"
      case name = "name"
      case owner = "owner"
      case ownerId = "owner_id"
      case public = "public"
      case type = "type"
      case updatedAt = "updated_at"
    }
  }
  internal struct BucketsInsert: Codable, Hashable, Sendable {
    internal let allowedMimeTypes: [String]?
    internal let avifAutodetection: Bool?
    internal let createdAt: String?
    internal let fileSizeLimit: Int64?
    internal let id: String
    internal let name: String
    internal let owner: UUID?
    internal let ownerId: String?
    internal let public: Bool?
    internal let type: Buckettype?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case allowedMimeTypes = "allowed_mime_types"
      case avifAutodetection = "avif_autodetection"
      case createdAt = "created_at"
      case fileSizeLimit = "file_size_limit"
      case id = "id"
      case name = "name"
      case owner = "owner"
      case ownerId = "owner_id"
      case public = "public"
      case type = "type"
      case updatedAt = "updated_at"
    }
  }
  internal struct BucketsUpdate: Codable, Hashable, Sendable {
    internal let allowedMimeTypes: [String]?
    internal let avifAutodetection: Bool?
    internal let createdAt: String?
    internal let fileSizeLimit: Int64?
    internal let id: String?
    internal let name: String?
    internal let owner: UUID?
    internal let ownerId: String?
    internal let public: Bool?
    internal let type: Buckettype?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case allowedMimeTypes = "allowed_mime_types"
      case avifAutodetection = "avif_autodetection"
      case createdAt = "created_at"
      case fileSizeLimit = "file_size_limit"
      case id = "id"
      case name = "name"
      case owner = "owner"
      case ownerId = "owner_id"
      case public = "public"
      case type = "type"
      case updatedAt = "updated_at"
    }
  }
  internal struct BucketsAnalyticsSelect: Codable, Hashable, Sendable {
    internal let createdAt: String
    internal let deletedAt: String?
    internal let format: String
    internal let id: UUID
    internal let name: String
    internal let type: Buckettype
    internal let updatedAt: String
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case deletedAt = "deleted_at"
      case format = "format"
      case id = "id"
      case name = "name"
      case type = "type"
      case updatedAt = "updated_at"
    }
  }
  internal struct BucketsAnalyticsInsert: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let deletedAt: String?
    internal let format: String?
    internal let id: UUID?
    internal let name: String
    internal let type: Buckettype?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case deletedAt = "deleted_at"
      case format = "format"
      case id = "id"
      case name = "name"
      case type = "type"
      case updatedAt = "updated_at"
    }
  }
  internal struct BucketsAnalyticsUpdate: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let deletedAt: String?
    internal let format: String?
    internal let id: UUID?
    internal let name: String?
    internal let type: Buckettype?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case deletedAt = "deleted_at"
      case format = "format"
      case id = "id"
      case name = "name"
      case type = "type"
      case updatedAt = "updated_at"
    }
  }
  internal struct BucketsVectorsSelect: Codable, Hashable, Sendable {
    internal let createdAt: String
    internal let id: String
    internal let type: Buckettype
    internal let updatedAt: String
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case id = "id"
      case type = "type"
      case updatedAt = "updated_at"
    }
  }
  internal struct BucketsVectorsInsert: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let id: String
    internal let type: Buckettype?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case id = "id"
      case type = "type"
      case updatedAt = "updated_at"
    }
  }
  internal struct BucketsVectorsUpdate: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let id: String?
    internal let type: Buckettype?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case id = "id"
      case type = "type"
      case updatedAt = "updated_at"
    }
  }
  internal struct IcebergNamespacesSelect: Codable, Hashable, Sendable {
    internal let bucketName: String
    internal let catalogId: UUID
    internal let createdAt: String
    internal let id: UUID
    internal let metadata: AnyJSON
    internal let name: String
    internal let updatedAt: String
    internal enum CodingKeys: String, CodingKey {
      case bucketName = "bucket_name"
      case catalogId = "catalog_id"
      case createdAt = "created_at"
      case id = "id"
      case metadata = "metadata"
      case name = "name"
      case updatedAt = "updated_at"
    }
  }
  internal struct IcebergNamespacesInsert: Codable, Hashable, Sendable {
    internal let bucketName: String
    internal let catalogId: UUID
    internal let createdAt: String?
    internal let id: UUID?
    internal let metadata: AnyJSON?
    internal let name: String
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case bucketName = "bucket_name"
      case catalogId = "catalog_id"
      case createdAt = "created_at"
      case id = "id"
      case metadata = "metadata"
      case name = "name"
      case updatedAt = "updated_at"
    }
  }
  internal struct IcebergNamespacesUpdate: Codable, Hashable, Sendable {
    internal let bucketName: String?
    internal let catalogId: UUID?
    internal let createdAt: String?
    internal let id: UUID?
    internal let metadata: AnyJSON?
    internal let name: String?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case bucketName = "bucket_name"
      case catalogId = "catalog_id"
      case createdAt = "created_at"
      case id = "id"
      case metadata = "metadata"
      case name = "name"
      case updatedAt = "updated_at"
    }
  }
  internal struct IcebergTablesSelect: Codable, Hashable, Sendable {
    internal let bucketName: String
    internal let catalogId: UUID
    internal let createdAt: String
    internal let id: UUID
    internal let location: String
    internal let name: String
    internal let namespaceId: UUID
    internal let remoteTableId: String?
    internal let shardId: String?
    internal let shardKey: String?
    internal let updatedAt: String
    internal enum CodingKeys: String, CodingKey {
      case bucketName = "bucket_name"
      case catalogId = "catalog_id"
      case createdAt = "created_at"
      case id = "id"
      case location = "location"
      case name = "name"
      case namespaceId = "namespace_id"
      case remoteTableId = "remote_table_id"
      case shardId = "shard_id"
      case shardKey = "shard_key"
      case updatedAt = "updated_at"
    }
  }
  internal struct IcebergTablesInsert: Codable, Hashable, Sendable {
    internal let bucketName: String
    internal let catalogId: UUID
    internal let createdAt: String?
    internal let id: UUID?
    internal let location: String
    internal let name: String
    internal let namespaceId: UUID
    internal let remoteTableId: String?
    internal let shardId: String?
    internal let shardKey: String?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case bucketName = "bucket_name"
      case catalogId = "catalog_id"
      case createdAt = "created_at"
      case id = "id"
      case location = "location"
      case name = "name"
      case namespaceId = "namespace_id"
      case remoteTableId = "remote_table_id"
      case shardId = "shard_id"
      case shardKey = "shard_key"
      case updatedAt = "updated_at"
    }
  }
  internal struct IcebergTablesUpdate: Codable, Hashable, Sendable {
    internal let bucketName: String?
    internal let catalogId: UUID?
    internal let createdAt: String?
    internal let id: UUID?
    internal let location: String?
    internal let name: String?
    internal let namespaceId: UUID?
    internal let remoteTableId: String?
    internal let shardId: String?
    internal let shardKey: String?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case bucketName = "bucket_name"
      case catalogId = "catalog_id"
      case createdAt = "created_at"
      case id = "id"
      case location = "location"
      case name = "name"
      case namespaceId = "namespace_id"
      case remoteTableId = "remote_table_id"
      case shardId = "shard_id"
      case shardKey = "shard_key"
      case updatedAt = "updated_at"
    }
  }
  internal struct MigrationsSelect: Codable, Hashable, Sendable {
    internal let executedAt: String?
    internal let hash: String
    internal let id: Int32
    internal let name: String
    internal enum CodingKeys: String, CodingKey {
      case executedAt = "executed_at"
      case hash = "hash"
      case id = "id"
      case name = "name"
    }
  }
  internal struct MigrationsInsert: Codable, Hashable, Sendable {
    internal let executedAt: String?
    internal let hash: String
    internal let id: Int32
    internal let name: String
    internal enum CodingKeys: String, CodingKey {
      case executedAt = "executed_at"
      case hash = "hash"
      case id = "id"
      case name = "name"
    }
  }
  internal struct MigrationsUpdate: Codable, Hashable, Sendable {
    internal let executedAt: String?
    internal let hash: String?
    internal let id: Int32?
    internal let name: String?
    internal enum CodingKeys: String, CodingKey {
      case executedAt = "executed_at"
      case hash = "hash"
      case id = "id"
      case name = "name"
    }
  }
  internal struct ObjectsSelect: Codable, Hashable, Sendable {
    internal let bucketId: String?
    internal let createdAt: String?
    internal let id: UUID
    internal let lastAccessedAt: String?
    internal let metadata: AnyJSON?
    internal let name: String?
    internal let owner: UUID?
    internal let ownerId: String?
    internal let pathTokens: [String]?
    internal let updatedAt: String?
    internal let userMetadata: AnyJSON?
    internal let version: String?
    internal enum CodingKeys: String, CodingKey {
      case bucketId = "bucket_id"
      case createdAt = "created_at"
      case id = "id"
      case lastAccessedAt = "last_accessed_at"
      case metadata = "metadata"
      case name = "name"
      case owner = "owner"
      case ownerId = "owner_id"
      case pathTokens = "path_tokens"
      case updatedAt = "updated_at"
      case userMetadata = "user_metadata"
      case version = "version"
    }
  }
  internal struct ObjectsInsert: Codable, Hashable, Sendable {
    internal let bucketId: String?
    internal let createdAt: String?
    internal let id: UUID?
    internal let lastAccessedAt: String?
    internal let metadata: AnyJSON?
    internal let name: String?
    internal let owner: UUID?
    internal let ownerId: String?
    internal let pathTokens: [String]?
    internal let updatedAt: String?
    internal let userMetadata: AnyJSON?
    internal let version: String?
    internal enum CodingKeys: String, CodingKey {
      case bucketId = "bucket_id"
      case createdAt = "created_at"
      case id = "id"
      case lastAccessedAt = "last_accessed_at"
      case metadata = "metadata"
      case name = "name"
      case owner = "owner"
      case ownerId = "owner_id"
      case pathTokens = "path_tokens"
      case updatedAt = "updated_at"
      case userMetadata = "user_metadata"
      case version = "version"
    }
  }
  internal struct ObjectsUpdate: Codable, Hashable, Sendable {
    internal let bucketId: String?
    internal let createdAt: String?
    internal let id: UUID?
    internal let lastAccessedAt: String?
    internal let metadata: AnyJSON?
    internal let name: String?
    internal let owner: UUID?
    internal let ownerId: String?
    internal let pathTokens: [String]?
    internal let updatedAt: String?
    internal let userMetadata: AnyJSON?
    internal let version: String?
    internal enum CodingKeys: String, CodingKey {
      case bucketId = "bucket_id"
      case createdAt = "created_at"
      case id = "id"
      case lastAccessedAt = "last_accessed_at"
      case metadata = "metadata"
      case name = "name"
      case owner = "owner"
      case ownerId = "owner_id"
      case pathTokens = "path_tokens"
      case updatedAt = "updated_at"
      case userMetadata = "user_metadata"
      case version = "version"
    }
  }
  internal struct S3MultipartUploadsSelect: Codable, Hashable, Sendable {
    internal let bucketId: String
    internal let createdAt: String
    internal let id: String
    internal let inProgressSize: Int64
    internal let key: String
    internal let metadata: AnyJSON?
    internal let ownerId: String?
    internal let uploadSignature: String
    internal let userMetadata: AnyJSON?
    internal let version: String
    internal enum CodingKeys: String, CodingKey {
      case bucketId = "bucket_id"
      case createdAt = "created_at"
      case id = "id"
      case inProgressSize = "in_progress_size"
      case key = "key"
      case metadata = "metadata"
      case ownerId = "owner_id"
      case uploadSignature = "upload_signature"
      case userMetadata = "user_metadata"
      case version = "version"
    }
  }
  internal struct S3MultipartUploadsInsert: Codable, Hashable, Sendable {
    internal let bucketId: String
    internal let createdAt: String?
    internal let id: String
    internal let inProgressSize: Int64?
    internal let key: String
    internal let metadata: AnyJSON?
    internal let ownerId: String?
    internal let uploadSignature: String
    internal let userMetadata: AnyJSON?
    internal let version: String
    internal enum CodingKeys: String, CodingKey {
      case bucketId = "bucket_id"
      case createdAt = "created_at"
      case id = "id"
      case inProgressSize = "in_progress_size"
      case key = "key"
      case metadata = "metadata"
      case ownerId = "owner_id"
      case uploadSignature = "upload_signature"
      case userMetadata = "user_metadata"
      case version = "version"
    }
  }
  internal struct S3MultipartUploadsUpdate: Codable, Hashable, Sendable {
    internal let bucketId: String?
    internal let createdAt: String?
    internal let id: String?
    internal let inProgressSize: Int64?
    internal let key: String?
    internal let metadata: AnyJSON?
    internal let ownerId: String?
    internal let uploadSignature: String?
    internal let userMetadata: AnyJSON?
    internal let version: String?
    internal enum CodingKeys: String, CodingKey {
      case bucketId = "bucket_id"
      case createdAt = "created_at"
      case id = "id"
      case inProgressSize = "in_progress_size"
      case key = "key"
      case metadata = "metadata"
      case ownerId = "owner_id"
      case uploadSignature = "upload_signature"
      case userMetadata = "user_metadata"
      case version = "version"
    }
  }
  internal struct S3MultipartUploadsPartsSelect: Codable, Hashable, Sendable {
    internal let bucketId: String
    internal let createdAt: String
    internal let etag: String
    internal let id: UUID
    internal let key: String
    internal let ownerId: String?
    internal let partNumber: Int32
    internal let size: Int64
    internal let uploadId: String
    internal let version: String
    internal enum CodingKeys: String, CodingKey {
      case bucketId = "bucket_id"
      case createdAt = "created_at"
      case etag = "etag"
      case id = "id"
      case key = "key"
      case ownerId = "owner_id"
      case partNumber = "part_number"
      case size = "size"
      case uploadId = "upload_id"
      case version = "version"
    }
  }
  internal struct S3MultipartUploadsPartsInsert: Codable, Hashable, Sendable {
    internal let bucketId: String
    internal let createdAt: String?
    internal let etag: String
    internal let id: UUID?
    internal let key: String
    internal let ownerId: String?
    internal let partNumber: Int32
    internal let size: Int64?
    internal let uploadId: String
    internal let version: String
    internal enum CodingKeys: String, CodingKey {
      case bucketId = "bucket_id"
      case createdAt = "created_at"
      case etag = "etag"
      case id = "id"
      case key = "key"
      case ownerId = "owner_id"
      case partNumber = "part_number"
      case size = "size"
      case uploadId = "upload_id"
      case version = "version"
    }
  }
  internal struct S3MultipartUploadsPartsUpdate: Codable, Hashable, Sendable {
    internal let bucketId: String?
    internal let createdAt: String?
    internal let etag: String?
    internal let id: UUID?
    internal let key: String?
    internal let ownerId: String?
    internal let partNumber: Int32?
    internal let size: Int64?
    internal let uploadId: String?
    internal let version: String?
    internal enum CodingKeys: String, CodingKey {
      case bucketId = "bucket_id"
      case createdAt = "created_at"
      case etag = "etag"
      case id = "id"
      case key = "key"
      case ownerId = "owner_id"
      case partNumber = "part_number"
      case size = "size"
      case uploadId = "upload_id"
      case version = "version"
    }
  }
  internal struct VectorIndexesSelect: Codable, Hashable, Sendable {
    internal let bucketId: String
    internal let createdAt: String
    internal let dataType: String
    internal let dimension: Int32
    internal let distanceMetric: String
    internal let id: String
    internal let metadataConfiguration: AnyJSON?
    internal let name: String
    internal let updatedAt: String
    internal enum CodingKeys: String, CodingKey {
      case bucketId = "bucket_id"
      case createdAt = "created_at"
      case dataType = "data_type"
      case dimension = "dimension"
      case distanceMetric = "distance_metric"
      case id = "id"
      case metadataConfiguration = "metadata_configuration"
      case name = "name"
      case updatedAt = "updated_at"
    }
  }
  internal struct VectorIndexesInsert: Codable, Hashable, Sendable {
    internal let bucketId: String
    internal let createdAt: String?
    internal let dataType: String
    internal let dimension: Int32
    internal let distanceMetric: String
    internal let id: String?
    internal let metadataConfiguration: AnyJSON?
    internal let name: String
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case bucketId = "bucket_id"
      case createdAt = "created_at"
      case dataType = "data_type"
      case dimension = "dimension"
      case distanceMetric = "distance_metric"
      case id = "id"
      case metadataConfiguration = "metadata_configuration"
      case name = "name"
      case updatedAt = "updated_at"
    }
  }
  internal struct VectorIndexesUpdate: Codable, Hashable, Sendable {
    internal let bucketId: String?
    internal let createdAt: String?
    internal let dataType: String?
    internal let dimension: Int32?
    internal let distanceMetric: String?
    internal let id: String?
    internal let metadataConfiguration: AnyJSON?
    internal let name: String?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case bucketId = "bucket_id"
      case createdAt = "created_at"
      case dataType = "data_type"
      case dimension = "dimension"
      case distanceMetric = "distance_metric"
      case id = "id"
      case metadataConfiguration = "metadata_configuration"
      case name = "name"
      case updatedAt = "updated_at"
    }
  }
}
