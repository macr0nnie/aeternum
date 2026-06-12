// =============================================================================
// Aeternum — Party Screen
// =============================================================================
import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useStore, selectPlayer, selectPartyMembers, selectPartyInvites } from '@/store/useStore'
import { SystemWindow, CornerPanel, SectionHeader, DungeonRankBadge } from '@/components/UI'
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, BORDER, LETTER_SPACING, elementAccent } from '@/theme/tokens'
import {
  searchPlayers, sendPartyInvite, respondToInvite,
  fetchPartyMembers, fetchPartyInvites,
  type PublicPlayer,
} from '@/lib/supabase'
import type { Element } from '@/types'
import type { PartyInvite } from '@/store/useStore'

const MemberCard: React.FC<{ member: PublicPlayer }> = ({ member }) => {
  const palette = elementAccent(member.primary_element as Element | null)
  return (
    <View style={[cardStyles.card, { borderLeftColor: palette.base }]}>
      <View style={cardStyles.row}>
        <DungeonRankBadge rank={member.rank as any} size="sm" />
        <View style={cardStyles.info}>
          <Text style={cardStyles.name}>{member.username}</Text>
          <Text style={cardStyles.sub}>
            {member.primary_element
              ? member.primary_element.charAt(0).toUpperCase() + member.primary_element.slice(1)
              : 'Unawakened'}{' · '}{member.total_distance_km.toFixed(1)} km{' · '}PWR {member.total_stat_power}
          </Text>
        </View>
      </View>
    </View>
  )
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderWidth: BORDER.thin, borderColor: COLORS.borderMid,
    borderLeftWidth: 3, borderRadius: RADIUS.slight, padding: SPACING.sm, marginBottom: SPACING.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1, marginLeft: SPACING.sm },
  name: { fontFamily: FONTS.heading, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary },
  sub: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
})

interface InviteRowProps {
  invite: PartyInvite; myId: string
  onAccept: (id: string) => void; onDecline: (id: string) => void
}
const InviteRow: React.FC<InviteRowProps> = ({ invite, myId, onAccept, onDecline }) => {
  const isIncoming = invite.to_player_id === myId
  return (
    <View style={invStyles.row}>
      <View style={{ flex: 1 }}>
        <Text style={invStyles.label}>{isIncoming ? '◆ INVITE FROM' : '◆ SENT TO'}</Text>
        <Text style={invStyles.id} numberOfLines={1}>
          {invite.from_username ?? (isIncoming ? invite.from_player_id : invite.to_player_id)}
        </Text>
      </View>
      {isIncoming && invite.status === 'pending' && (
        <View style={invStyles.actions}>
          <TouchableOpacity style={[invStyles.btn, invStyles.acceptBtn]} onPress={() => onAccept(invite.id)} activeOpacity={0.75}>
            <Text style={invStyles.acceptTxt}>ACCEPT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[invStyles.btn, invStyles.declineBtn]} onPress={() => onDecline(invite.id)} activeOpacity={0.75}>
            <Text style={invStyles.declineTxt}>DECLINE</Text>
          </TouchableOpacity>
        </View>
      )}
      {!isIncoming && (
        <Text style={[invStyles.status, {
          color: invite.status === 'accepted' ? COLORS.success : invite.status === 'declined' ? COLORS.error : COLORS.textTertiary,
        }]}>{invite.status.toUpperCase()}</Text>
      )}
    </View>
  )
}
const invStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLow },
  label: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.wide },
  id: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  actions: { flexDirection: 'row', gap: SPACING.xs },
  btn: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.xs, borderWidth: BORDER.thin },
  acceptBtn: { borderColor: COLORS.success },
  declineBtn: { borderColor: COLORS.error },
  acceptTxt: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.success, letterSpacing: LETTER_SPACING.wide },
  declineTxt: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.error, letterSpacing: LETTER_SPACING.wide },
  status: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs },
})

interface SearchRowProps {
  player: PublicPlayer; alreadyInvited: boolean; isPartyMember: boolean; onInvite: () => void
}
const SearchRow: React.FC<SearchRowProps> = ({ player, alreadyInvited, isPartyMember, onInvite }) => (
  <View style={srStyles.row}>
    <DungeonRankBadge rank={player.rank as any} size="sm" />
    <View style={srStyles.info}>
      <Text style={srStyles.name}>{player.username}</Text>
      <Text style={srStyles.sub}>{player.total_distance_km.toFixed(1)} km · PWR {player.total_stat_power}</Text>
    </View>
    {isPartyMember ? (
      <Text style={srStyles.inParty}>IN PARTY</Text>
    ) : (
      <TouchableOpacity style={[srStyles.inviteBtn, alreadyInvited && srStyles.invitedBtn]} onPress={onInvite} disabled={alreadyInvited} activeOpacity={0.75}>
        <Text style={[srStyles.inviteTxt, alreadyInvited && { color: COLORS.textTertiary }]}>{alreadyInvited ? 'SENT' : 'INVITE'}</Text>
      </TouchableOpacity>
    )}
  </View>
)
const srStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLow },
  info: { flex: 1, marginLeft: SPACING.sm },
  name: { fontFamily: FONTS.heading, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary },
  sub: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  inviteBtn: { borderWidth: BORDER.thin, borderColor: COLORS.system, borderRadius: RADIUS.xs, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  invitedBtn: { borderColor: COLORS.textTertiary },
  inviteTxt: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.system, letterSpacing: LETTER_SPACING.wide },
  inParty: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.success, letterSpacing: LETTER_SPACING.wide },
})

export default function PartyScreen() {
  const player = useStore(selectPlayer)
  const partyMembers = useStore(selectPartyMembers)
  const partyInvites = useStore(selectPartyInvites)
  const { setPartyMembers, setPartyInvites } = useStore()

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PublicPlayer[]>([])
  const [searching, setSearching] = useState(false)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)

  const loadPartyData = useCallback(async () => {
    if (!player) return
    const [members, invites] = await Promise.all([fetchPartyMembers(player.id), fetchPartyInvites(player.id)])
    setPartyMembers(members)
    if (invites.data) setPartyInvites(invites.data as PartyInvite[])
  }, [player, setPartyMembers, setPartyInvites])

  useEffect(() => { loadPartyData() }, [loadPartyData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await loadPartyData(); setRefreshing(false)
  }, [loadPartyData])

  async function handleSearch(text: string) {
    setQuery(text)
    if (text.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const { data } = await searchPlayers(text)
      setSearchResults(((data ?? []) as PublicPlayer[]).filter(p => p.id !== player?.id))
    } catch { setSearchResults([]) } finally { setSearching(false) }
  }

  async function handleInvite(toId: string) {
    if (!player) return
    try { await sendPartyInvite(player.id, toId); setSentIds(prev => new Set([...prev, toId])) } catch { /* already sent */ }
  }

  async function handleAccept(inviteId: string) { await respondToInvite(inviteId, 'accepted'); await loadPartyData() }
  async function handleDecline(inviteId: string) { await respondToInvite(inviteId, 'declined'); await loadPartyData() }

  const memberIds = new Set(partyMembers.map(m => m.id))
  const pendingInvites = partyInvites.filter(i => i.status === 'pending')
  const incomingCount = pendingInvites.filter(i => i.to_player_id === player?.id).length

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.system} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>◆ PARTY ◆</Text>
          <Text style={styles.sub}>
            {partyMembers.length} MEMBER{partyMembers.length !== 1 ? 'S' : ''}
            {incomingCount > 0 ? `  ·  ${incomingCount} INVITE${incomingCount > 1 ? 'S' : ''}` : ''}
          </Text>
        </View>

        <SectionHeader title="FIND HUNTERS" />
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username..."
            placeholderTextColor={COLORS.textTertiary}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searching && <ActivityIndicator size="small" color={COLORS.system} style={{ marginLeft: SPACING.sm }} />}
        </View>

        {searchResults.length > 0 && (
          <CornerPanel>
            {searchResults.map(p => (
              <SearchRow
                key={p.id}
                player={p}
                alreadyInvited={sentIds.has(p.id) || partyInvites.some(i => i.to_player_id === p.id && i.from_player_id === player?.id)}
                isPartyMember={memberIds.has(p.id)}
                onInvite={() => handleInvite(p.id)}
              />
            ))}
          </CornerPanel>
        )}

        {pendingInvites.length > 0 && (
          <>
            <SectionHeader title={incomingCount > 0 ? `INVITES (${incomingCount} INCOMING)` : 'PENDING INVITES'} />
            <CornerPanel>
              {pendingInvites.map(inv => (
                <InviteRow key={inv.id} invite={inv} myId={player?.id ?? ''} onAccept={handleAccept} onDecline={handleDecline} />
              ))}
            </CornerPanel>
          </>
        )}

        <SectionHeader title="YOUR PARTY" />
        {partyMembers.length === 0 ? (
          <SystemWindow title="NO PARTY YET" variant="info">
            <Text style={styles.emptyText}>
              Search for hunters by username and send an invite. Once accepted, you can tackle C-rank+ gates together — pooling your stats for a shared advantage.
            </Text>
          </SystemWindow>
        ) : (
          partyMembers.map(m => <MemberCard key={m.id} member={m} />)
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ground },
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xl },
  header: { alignItems: 'center', marginBottom: SPACING.lg },
  title: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xl, color: COLORS.system, letterSpacing: LETTER_SPACING.widest },
  sub: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 4, letterSpacing: LETTER_SPACING.wide },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  searchInput: {
    flex: 1, backgroundColor: COLORS.surface, borderWidth: BORDER.thin, borderColor: COLORS.systemBorder,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
    fontFamily: FONTS.mono, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary,
  },
  emptyText: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, lineHeight: 18 },
})
