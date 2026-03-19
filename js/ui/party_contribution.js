/**
 * ui/party_contribution.js — 파티 내 오퍼레이터별 개별 데미지 합산 표시
 *
 * [역할]
 * - 파티 탭에서 각 오퍼레이터(메인 + 서브 1~3)가 자신의 사이클 설정에 따라 가하는 데미지를 계산합니다.
 * - 각 오퍼레이터의 '저장된 개별 설정(opSettings)'을 불러와 현재 파티 버프 상태에서 사이클 효율을 측정합니다.
 */

function renderPartyContribution() {
    const container = document.getElementById('analysis-party-content');
    if (!container) return;

    if (!state.mainOp.id) {
        container.innerHTML = `
            <div class="empty-state-container">
                <div class="empty-state-icon">✦</div>
                <p class="empty-state-text">메인 오퍼레이터를 선택해주세요.</p>
            </div>
        `;
        return;
    }

    const party = [
        { type: 'main', id: state.mainOp.id, index: -1 },
        ...state.subOps.map((sub, idx) => ({ type: 'sub', id: sub.id, index: idx }))
    ].filter(p => p.id);

    const aggregatedDamage = {};
    party.forEach(p => {
        if (p.id) aggregatedDamage[p.id] = 0;
    });

    party.forEach(member => {
        const opData = getOperatorData(member.id);
        const settings = loadOpSettings(member.id) || {};

        // 해당 오퍼레이터를 메인으로 하는 가상 상태(virtual state) 생성
        let virtualState = { ...state, subOps: [...state.subOps] };
        virtualState._subStatsCache = null; // 캐시 무효화 (기존 mainOp이 sub가 되므로 갱신 필요)

        // 메인/서브 위치에 따른 데이터 교체
        if (member.type === 'sub') {
            // 현재 메인을 서브로, 타겟 서브를 메인으로 교체
            const currentMain = { ...state.mainOp };
            const targetSub = { ...state.subOps[member.index] };

            virtualState.mainOp = {
                id: targetSub.id,
                pot: targetSub.pot,
                wepId: targetSub.wepId,
                wepPot: targetSub.wepPot,
                wepState: targetSub.wepState,
                gears: [...targetSub.gears],
                gearForged: [...targetSub.gearForged],
                skillLevels: targetSub.skillLevels || { '일반 공격': 'M3', '배틀 스킬': 'M3', '연계 스킬': 'M3', '궁극기': 'M3' },
                specialStack: settings.specialStack || {}, // 서브 전용 스택이 있다면 반영
            };

            virtualState.subOps[member.index] = {
                id: currentMain.id,
                pot: currentMain.pot,
                wepId: currentMain.wepId,
                wepPot: currentMain.wepPot,
                wepState: currentMain.wepState,
                gears: [...currentMain.gears],
                gearForged: [...currentMain.gearForged],
                skillLevels: currentMain.skillLevels
            };
        }

        // 1. 모든 파티 멤버의 설정을 수집하여 가상 상태의 disabledEffects / effectStacks 구성
        const mergedDisabled = [];
        const mergedStacks = {};

        party.forEach(p => {
            const isTargetMain = p.id === member.id;
            const pSettings = loadOpSettings(p.id) || {};
            let prefix = '';

            if (isTargetMain) {
                // 이 멤버가 지금 계산 대상(메인)인 경우
                prefix = '';
            } else {
                // 이 멤버가 가상 파티에서 서브인 경우
                let vIdx = -1;
                if (p.type === 'main') {
                    // 원래 메인이었던 애가 p인 경우, 현재 계산 대상의 인덱스 위치로 감
                    vIdx = member.index;
                } else {
                    // 원래 서브였던 애가 p인 경우, 인덱스가 유지됨 (p.id !== member.id 상황)
                    vIdx = p.index;
                }
                prefix = `sub_${vIdx}_`;
            }

            // 비활성 효과 병합
            const dEffs = isTargetMain && p.type === 'main' ? (state.disabledEffects || []) : (pSettings.disabledEffects || []);
            dEffs.forEach(uid => {
                if (!uid.startsWith('sub_')) { // 이미 접두사가 있는 경우는 무시하거나 처리 (구조상 없을 것)
                    mergedDisabled.push(prefix + uid);
                }
            });

            // 스택 병합
            const eStacks = isTargetMain && p.type === 'main' ? (state.effectStacks || {}) : (pSettings.effectStacks || {});
            Object.entries(eStacks).forEach(([uid, val]) => {
                if (!uid.startsWith('sub_')) {
                    mergedStacks[prefix + uid] = val;
                }
            });
        });

        virtualState.disabledEffects = mergedDisabled;
        virtualState.effectStacks = mergedStacks;

        // 2. 현재 상태의 소모품 및 적 상태 등 기타 환경 적용
        virtualState.debuffState = state.debuffState;
        virtualState.usables = state.usables;

        // [New] 만약 메인 계산 대상의 개별 설정에 사이클이나 레벨이 있다면 덮어쓰기
        if (member.type === 'sub') {
            const subSettings = settings;
            if (subSettings.skillSequence && subSettings.skillSequence.length > 0) {
                virtualState.skillSequence = subSettings.skillSequence;
            } else {
                virtualState.skillSequence = ['일반 공격', '배틀 스킬', '연계 스킬', '궁극기'].map((t, i) => ({
                    id: `def_${Date.now()}_${i}`,
                    type: t,
                    customState: null
                }));
            }
            if (subSettings.skillLevels) {
                virtualState.mainOp.skillLevels = subSettings.skillLevels;
            }
        } else {
            virtualState.skillSequence = state.skillSequence;
        }

        virtualState.selectedSeqIds = [];

        // 데미지 계산 및 기여도 추출
        const res = calculateDamage(virtualState);
        const cycleRes = res ? calculateCycleDamage(virtualState, res) : null;

        if (typeof calculateDamageContribution === 'function') {
            const contributions = calculateDamageContribution(virtualState, cycleRes);
            contributions.forEach(c => {
                if (c.opId) {
                    aggregatedDamage[c.opId] = (aggregatedDamage[c.opId] || 0) + c.damage;
                }
            });
        }
    });

    const results = party.map(member => {
        const opData = getOperatorData(member.id);
        return {
            id: member.id,
            name: opData?.name || 'Unknown',
            damage: aggregatedDamage[member.id] || 0,
            isMain: member.type === 'main'
        };
    });

    const totalPartyDmg = results.reduce((sum, r) => sum + r.damage, 0);

    // 렌더링 HTML 생성
    let html = `
        <div class="analysis-tab-inner">
            <div class="tile party-total-tile" data-tile-id="party-total" data-full-row="true">
                <h3>파티 사이클 계산값 총합</h3>
                <div class="party-total-dmg-value">${Math.floor(totalPartyDmg).toLocaleString()}</div>
            </div>
            
            <div class="tile" data-tile-id="party-contrib-list" data-full-row="true">
                <h3>파티 데미지 기여도</h3>
                <div class="dmg-contrib-list">
    `;

    results.sort((a, b) => b.damage - a.damage).forEach((item, idx) => {
        const sharePct = totalPartyDmg > 0 ? (item.damage / totalPartyDmg) * 100 : 0;
        const mainBadge = item.isMain ? ' (메인)' : '';

        html += `
            <div class="dmg-contrib-item active">
                <div class="op-image-container dmg-contrib-img-box">
                    <img src="images/operators/${item.name}.webp" class="dmg-contrib-img loaded" alt="${item.name}" onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'">
                </div>
                <div class="dmg-contrib-info-col">
                    <div class="dmg-contrib-header">
                        <span class="dmg-contrib-name">${item.name}${mainBadge}</span>
                        <div class="dmg-contrib-val-wrap">
                            <span class="dmg-contrib-val">${Math.floor(item.damage).toLocaleString()}</span>
                            <span class="dmg-contrib-pct">${sharePct.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div class="dmg-contrib-bar-track">
                        <div class="dmg-contrib-bar-fill ${item.isMain ? 'main-op' : ''}" style="width: ${sharePct.toFixed(1)}%;"></div>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

window.renderPartyContribution = renderPartyContribution;
