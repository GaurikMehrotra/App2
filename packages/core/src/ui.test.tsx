import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
import { Button, Field } from "./index";
test("button is accessible and disabled controls cannot execute actions", () => {
  const press = jest.fn();
  const screen = render(<Button title="Publish" onPress={press} disabled />);
  fireEvent.press(screen.getByRole("button"));
  expect(press).not.toHaveBeenCalled();
  screen.rerender(<Button title="Publish" onPress={press} />);
  fireEvent.press(screen.getByRole("button"));
  expect(press).toHaveBeenCalledTimes(1);
});
test("field exposes its label and change callback", () => {
  const change = jest.fn();
  const screen = render(<Field label="Bio" value="" onChangeText={change} />);
  fireEvent.changeText(screen.getByLabelText("Bio"), "Hello");
  expect(change).toHaveBeenCalledWith("Hello");
});
