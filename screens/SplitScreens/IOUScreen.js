import React, {useState, useCallback} from 'react';
import {View, StyleSheet, TouchableOpacity, RefreshControl, Platform, Alert} from 'react-native';
import {Text, Card, ActivityIndicator} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import UserAvatar from 'react-native-user-avatar';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {useFocusEffect} from '@react-navigation/native';
import {useCurrency} from '../../utils/CurrencyUtil';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const SUCCESS_COLOR = '#25B07F';
const EXPENSE_COLOR = '#F64E4E';

const IOUScreen = ({navigation}) => {
  const {formatAmount} = useCurrency();
  const [tab, setTab] = useState('iowe');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [iOwe, setIOwe] = useState([]);
  const [owedToMe, setOwedToMe] = useState([]);

  const loadIOUs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;
      const email = currentUser.email?.toLowerCase();
      const [fromSnap, toSnap] = await Promise.all([
        firestore().collection('ious').where('fromEmail', '==', email).where('status', '==', 'pending').orderBy('createdAt', 'desc').get(),
        firestore().collection('ious').where('toEmail', '==', email).where('status', '==', 'pending').orderBy('createdAt', 'desc').get(),
      ]);
      setIOwe(fromSnap.docs.map(d => ({id: d.id, ...d.data()})));
      setOwedToMe(toSnap.docs.map(d => ({id: d.id, ...d.data()})));
    } catch (_) {
      setIOwe([]);
      setOwedToMe([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadIOUs();
  }, [loadIOUs]));

  const markSettled = async (iou) => {
    Alert.alert('Mark Settled', `Mark this IOU as settled?`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Settle', onPress: async () => {
        try {
          await firestore().collection('ious').doc(iou.id).update({status: 'settled', settledAt: firestore.FieldValue.serverTimestamp()});
          loadIOUs(true);
        } catch (_) {
          Alert.alert('Error', 'Failed to mark as settled');
        }
      }},
    ]);
  };

  const renderIOU = (iou, isDebtor) => {
    const name = isDebtor ? (iou.toName || iou.toEmail) : (iou.fromName || iou.fromEmail);
    const color = isDebtor ? EXPENSE_COLOR : SUCCESS_COLOR;
    const labelPrefix = isDebtor ? 'To' : 'From';
    const date = iou.createdAt?.toDate?.()?.toLocaleDateString() || '';
    return (
      <Card key={iou.id} style={[styles.iouCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 1}>
        <View style={styles.iouCardContent}>
          <UserAvatar size={44} name={name} />
          <View style={styles.iouInfo}>
            <Text style={styles.iouName}>{name}</Text>
            <Text style={styles.iouLabel}>{labelPrefix}: {iou.toEmail || iou.fromEmail}</Text>
            {iou.notes ? <Text style={styles.iouNotes} numberOfLines={2}>{iou.notes}</Text> : null}
            <Text style={styles.iouDate}>{date}</Text>
          </View>
          <View style={styles.iouRight}>
            <Text style={[styles.iouAmount, {color}]}>{formatAmount(iou.amount)}</Text>
            <TouchableOpacity onPress={() => markSettled(iou)} style={styles.settleButton}>
              <Text style={styles.settleButtonText}>Settle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  };

  const activeList = tab === 'iowe' ? iOwe : owedToMe;
  const isDebtor = tab === 'iowe';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading IOUs...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <KeyboardAwareScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadIOUs(true)} colors={[PRIMARY_COLOR]} tintColor={PRIMARY_COLOR} />}>
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="handshake" size={32} color={PRIMARY_COLOR} />
              <Text style={styles.headerTitle}>IOUs</Text>
            </View>
            <Text style={styles.headerSubtitle}>Track personal debts without a group</Text>
          </View>
          <View style={styles.tabRow}>
            <TouchableOpacity style={[styles.tab, tab === 'iowe' && styles.tabActive]} onPress={() => setTab('iowe')}>
              <Text style={[styles.tabText, tab === 'iowe' && styles.tabTextActive]}>I Owe ({iOwe.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, tab === 'owedtome' && styles.tabActive]} onPress={() => setTab('owedtome')}>
              <Text style={[styles.tabText, tab === 'owedtome' && styles.tabTextActive]}>Owed to Me ({owedToMe.length})</Text>
            </TouchableOpacity>
          </View>
          {activeList.length === 0 ? (
            <Card style={[styles.emptyCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 2}>
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="handshake" size={64} color="#CBD3EE" />
                <Text style={styles.emptyTitle}>{tab === 'iowe' ? 'You owe nothing!' : 'Nobody owes you'}</Text>
                <Text style={styles.emptySubtitle}>Tap + to record a new IOU</Text>
              </View>
            </Card>
          ) : (
            activeList.map(iou => renderIOU(iou, isDebtor))
          )}
          <View style={{height: 80}} />
        </KeyboardAwareScrollView>
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateIOU')}>
          <MaterialCommunityIcons name="plus" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollView: {flex: 1},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BACKGROUND_COLOR},
  loadingText: {fontSize: 16, color: PRIMARY_COLOR, marginTop: 15, fontFamily: 'Lato-Regular'},
  headerSection: {alignItems: 'center', paddingHorizontal: 20, paddingTop: 30, paddingBottom: 20},
  headerTitleRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  headerTitle: {fontSize: 28, fontWeight: 'bold', color: PRIMARY_COLOR, fontFamily: 'Kufam-SemiBoldItalic', marginLeft: 12},
  headerSubtitle: {fontSize: 16, color: '#666', textAlign: 'center', fontFamily: 'Lato-Regular'},
  tabRow: {flexDirection: 'row', marginHorizontal: 20, marginBottom: 15, backgroundColor: '#E8EBF7', borderRadius: 12, padding: 4},
  tab: {flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10},
  tabActive: {backgroundColor: PRIMARY_COLOR},
  tabText: {fontSize: 14, color: PRIMARY_COLOR, fontFamily: 'Lato-Bold'},
  tabTextActive: {color: '#FFFFFF'},
  iouCard: {backgroundColor: '#FFFFFF', borderRadius: 16, marginHorizontal: 20, marginBottom: 12},
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
  iouCardContent: {flexDirection: 'row', alignItems: 'center', padding: 16},
  iouInfo: {flex: 1, marginLeft: 14},
  iouName: {fontSize: 16, fontWeight: '600', color: '#2C2C2C', fontFamily: 'Lato-Bold'},
  iouLabel: {fontSize: 12, color: '#888', fontFamily: 'Lato-Regular', marginTop: 1},
  iouNotes: {fontSize: 13, color: '#555', fontFamily: 'Lato-Regular', marginTop: 3},
  iouDate: {fontSize: 11, color: '#aaa', fontFamily: 'Lato-Regular', marginTop: 2},
  iouRight: {alignItems: 'flex-end'},
  iouAmount: {fontSize: 18, fontWeight: 'bold', fontFamily: 'Kufam-SemiBoldItalic'},
  settleButton: {marginTop: 8, backgroundColor: SUCCESS_COLOR, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8},
  settleButtonText: {fontSize: 12, color: '#fff', fontFamily: 'Lato-Bold'},
  emptyCard: {backgroundColor: '#FFFFFF', borderRadius: 20, marginHorizontal: 20, marginTop: 20},
  emptyState: {alignItems: 'center', paddingVertical: 50},
  emptyTitle: {fontSize: 18, fontWeight: '600', color: '#666', marginTop: 15, fontFamily: 'Lato-Bold'},
  emptySubtitle: {fontSize: 14, color: '#888', textAlign: 'center', marginTop: 5, fontFamily: 'Lato-Regular'},
  fab: {position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center', elevation: Platform.OS === 'android' ? 0 : 4, ...(Platform.OS !== 'android' && {shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.25, shadowRadius: 4})},
});

export default IOUScreen;
