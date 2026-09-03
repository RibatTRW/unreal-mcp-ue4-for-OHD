def take_screenshot():
    return take_editor_screenshot(640, 520)


def main():
    path = take_screenshot()
    if path:
        print(path)
    else:
        print("Failed to take screenshot")


if __name__ == "__main__":
    main()
