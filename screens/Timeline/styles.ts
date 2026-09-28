import { StyleSheet } from 'react-native';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A'
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        height: 60,
        backgroundColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#334155'
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#F8FAFC',
    },
    listContent: {
        paddingTop: 8,
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    emptyContainer: {
        marginTop: 100,
        alignItems: 'center',
        justifyContent: 'center'
    },
    emptyText: {
        color: '#94A3B8',
        fontSize: 16,
        textAlign: 'center'
    }
})