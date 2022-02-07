const allowedKeys = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]

function handleInput(el, event) {
    if (event.key === "Backspace") return

    if (allowedKeys.indexOf(event.key) < 0 || el.value.length === 5) event.preventDefault()

    // if (event.key === "Enter" && !loading) searchLocation(el.value)
}