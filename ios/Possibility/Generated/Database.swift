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
    internal let audioPath: String?
    internal let createdAt: String
    internal let emotions: [String]?
    internal let id: Int64
    internal let keywords: [String]?
    internal let transcript: String?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case audioPath = "audio_path"
      case createdAt = "created_at"
      case emotions = "emotions"
      case id = "id"
      case keywords = "keywords"
      case transcript = "transcript"
      case userId = "user_id"
    }
  }
  internal struct DiaryEntriesInsert: Codable, Hashable, Sendable {
    internal let audioPath: String?
    internal let createdAt: String?
    internal let emotions: [String]?
    internal let id: Int64?
    internal let keywords: [String]?
    internal let transcript: String?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case audioPath = "audio_path"
      case createdAt = "created_at"
      case emotions = "emotions"
      case id = "id"
      case keywords = "keywords"
      case transcript = "transcript"
      case userId = "user_id"
    }
  }
  internal struct DiaryEntriesUpdate: Codable, Hashable, Sendable {
    internal let audioPath: String?
    internal let createdAt: String?
    internal let emotions: [String]?
    internal let id: Int64?
    internal let keywords: [String]?
    internal let transcript: String?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case audioPath = "audio_path"
      case createdAt = "created_at"
      case emotions = "emotions"
      case id = "id"
      case keywords = "keywords"
      case transcript = "transcript"
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
  internal struct ProfileAiPermissionsSelect: Codable, Hashable, Sendable {
    internal let createdAt: String
    internal let permissions: AnyJSON
    internal let updatedAt: String
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case permissions = "permissions"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct ProfileAiPermissionsInsert: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let permissions: AnyJSON?
    internal let updatedAt: String?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case permissions = "permissions"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct ProfileAiPermissionsUpdate: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let permissions: AnyJSON?
    internal let updatedAt: String?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case permissions = "permissions"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct ProfileDimensionsSelect: Codable, Hashable, Sendable {
    internal let createdAt: String
    internal let dimension: String
    internal let id: Int64
    internal let source: String
    internal let tags: [String]
    internal let updatedAt: String
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case dimension = "dimension"
      case id = "id"
      case source = "source"
      case tags = "tags"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct ProfileDimensionsInsert: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let dimension: String
    internal let id: Int64?
    internal let source: String?
    internal let tags: [String]?
    internal let updatedAt: String?
    internal let userId: UUID
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case dimension = "dimension"
      case id = "id"
      case source = "source"
      case tags = "tags"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct ProfileDimensionsUpdate: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let dimension: String?
    internal let id: Int64?
    internal let source: String?
    internal let tags: [String]?
    internal let updatedAt: String?
    internal let userId: UUID?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case dimension = "dimension"
      case id = "id"
      case source = "source"
      case tags = "tags"
      case updatedAt = "updated_at"
      case userId = "user_id"
    }
  }
  internal struct ProfileFactsSelect: Codable, Hashable, Sendable {
    internal let confidence: Decimal
    internal let createdAt: String
    internal let dimension: String
    internal let id: UUID
    internal let observedAt: String
    internal let source: String
    internal let sourceRef: String?
    internal let status: String
    internal let updatedAt: String
    internal let userConfirmed: Bool
    internal let userId: UUID
    internal let value: String
    internal enum CodingKeys: String, CodingKey {
      case confidence = "confidence"
      case createdAt = "created_at"
      case dimension = "dimension"
      case id = "id"
      case observedAt = "observed_at"
      case source = "source"
      case sourceRef = "source_ref"
      case status = "status"
      case updatedAt = "updated_at"
      case userConfirmed = "user_confirmed"
      case userId = "user_id"
      case value = "value"
    }
  }
  internal struct ProfileFactsInsert: Codable, Hashable, Sendable {
    internal let confidence: Decimal?
    internal let createdAt: String?
    internal let dimension: String
    internal let id: UUID?
    internal let observedAt: String?
    internal let source: String?
    internal let sourceRef: String?
    internal let status: String?
    internal let updatedAt: String?
    internal let userConfirmed: Bool?
    internal let userId: UUID
    internal let value: String
    internal enum CodingKeys: String, CodingKey {
      case confidence = "confidence"
      case createdAt = "created_at"
      case dimension = "dimension"
      case id = "id"
      case observedAt = "observed_at"
      case source = "source"
      case sourceRef = "source_ref"
      case status = "status"
      case updatedAt = "updated_at"
      case userConfirmed = "user_confirmed"
      case userId = "user_id"
      case value = "value"
    }
  }
  internal struct ProfileFactsUpdate: Codable, Hashable, Sendable {
    internal let confidence: Decimal?
    internal let createdAt: String?
    internal let dimension: String?
    internal let id: UUID?
    internal let observedAt: String?
    internal let source: String?
    internal let sourceRef: String?
    internal let status: String?
    internal let updatedAt: String?
    internal let userConfirmed: Bool?
    internal let userId: UUID?
    internal let value: String?
    internal enum CodingKeys: String, CodingKey {
      case confidence = "confidence"
      case createdAt = "created_at"
      case dimension = "dimension"
      case id = "id"
      case observedAt = "observed_at"
      case source = "source"
      case sourceRef = "source_ref"
      case status = "status"
      case updatedAt = "updated_at"
      case userConfirmed = "user_confirmed"
      case userId = "user_id"
      case value = "value"
    }
  }
  internal struct ProfilesSelect: Codable, Hashable, Sendable {
    internal let createdAt: String
    internal let dims: AnyJSON
    internal let id: UUID
    internal let portraitPct: Int16
    internal let profileRevision: Int64
    internal let updatedAt: String
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case dims = "dims"
      case id = "id"
      case portraitPct = "portrait_pct"
      case profileRevision = "profile_revision"
      case updatedAt = "updated_at"
    }
  }
  internal struct ProfilesInsert: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let dims: AnyJSON?
    internal let id: UUID
    internal let portraitPct: Int16?
    internal let profileRevision: Int64?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case dims = "dims"
      case id = "id"
      case portraitPct = "portrait_pct"
      case profileRevision = "profile_revision"
      case updatedAt = "updated_at"
    }
  }
  internal struct ProfilesUpdate: Codable, Hashable, Sendable {
    internal let createdAt: String?
    internal let dims: AnyJSON?
    internal let id: UUID?
    internal let portraitPct: Int16?
    internal let profileRevision: Int64?
    internal let updatedAt: String?
    internal enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case dims = "dims"
      case id = "id"
      case portraitPct = "portrait_pct"
      case profileRevision = "profile_revision"
      case updatedAt = "updated_at"
    }
  }
  internal struct PublicProfilesSelect: Codable, Hashable, Sendable {
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
    internal let visibility: AnyJSON
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
      case visibility = "visibility"
    }
  }
  internal struct PublicProfilesInsert: Codable, Hashable, Sendable {
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
    internal let visibility: AnyJSON?
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
      case visibility = "visibility"
    }
  }
  internal struct PublicProfilesUpdate: Codable, Hashable, Sendable {
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
    internal let visibility: AnyJSON?
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
      case visibility = "visibility"
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
