import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "./index";
export async function registerPush(userId: string) {
  if (Platform.OS === "web")
    throw new Error(
      "Push registration is available in native development builds.",
    );
  const Notifications = await import("expo-notifications");
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;
  if (!projectId)
    throw new Error("Set your EAS project ID before registering push.");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("conversations", {
      name: "Conversations",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error("Notification permission not granted.");
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await api
    .from("notification_settings")
    .upsert({ user_id: userId, push_token: token.data });
  if (error) throw error;
  return true;
}
