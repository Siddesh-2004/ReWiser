import { useLocalSearchParams } from 'expo-router';
import TopicForm from '../../../components/TopicForm';

export default function EditTopic() {
  const { id } = useLocalSearchParams(); // the [id] in the file name
  return <TopicForm topicId={id} />;
}
