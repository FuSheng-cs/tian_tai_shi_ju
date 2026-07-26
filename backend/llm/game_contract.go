package llm

const (
	GameTitle               = "天台十句"
	CharacterName           = "艾"
	InitialRoundCount       = 10
	AffectionBoostValue     = 5
	AffectionBoostTag       = "[好感度+5]"
	EmotionStingLabel       = "刺痛"
	EmotionStingTag         = "[情绪:刺痛]"
	EmotionSurpriseLabel    = "惊讶"
	EmotionSurpriseTag      = "[情绪:惊讶]"
	EmotionSoftLabel        = "柔软"
	EmotionSoftTag          = "[情绪:柔软]"
	EmotionCuriosityLabel   = "好奇"
	EmotionCuriosityTag     = "[情绪:好奇]"
	AiStateGuardedLabel     = "戒备"
	AiStateGuardedTag       = "[状态:戒备]"
	AiStateWatchingLabel    = "观察"
	AiStateWatchingTag      = "[状态:观察]"
	AiStateWaveringLabel    = "动摇"
	AiStateWaveringTag      = "[状态:动摇]"
	AiStateTurnBackLabel    = "回身"
	AiStateTurnBackTag      = "[状态:回身]"
	AiStateEdgeLabel        = "临界"
	AiStateEdgeTag          = "[状态:临界]"
	EndingDeathType         = "end_death"
	EndingDeathLabel        = "死亡"
	EndingDeathTag          = "[结局:死亡]"
	EndingDisappearType     = "end_disappear"
	EndingDisappearLabel    = "消失"
	EndingDisappearTag      = "[结局:消失]"
	EndingAcquaintanceType  = "end_acquaintance"
	EndingAcquaintanceLabel = "相识"
	EndingAcquaintanceTag   = "[结局:相识]"

	// 结局数值门槛与前端 legacy_vue/src/domain/gameContract.ts 的 ENDING_THRESHOLDS 逐项对应，
	// 改动必须两侧同步；一致性由 llm/game_contract_test.go 与
	// legacy_vue/tests/gameContract.test.ts 各自断言。
	EndingDisappearMinAffection              = 20
	EndingDisappearMinAffectionBoostCount    = 4
	EndingDisappearMinTurnsUsed              = 7
	EndingAcquaintanceMinAffection           = 25
	EndingAcquaintanceMinAffectionBoostCount = 5
	EndingAcquaintanceMinTurnsUsed           = 7
)
