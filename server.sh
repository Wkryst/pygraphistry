#!/usr/bin/env bash

########
# This script kicks off a small web server in order to test out the site running
# in the browser. If $WEBKITWEBCL_PATH is set in your environment to the path of
# WebKit.app, or can be set by sourcing ~/.webkitwebcl, then we also run the
# special WebKit WebCL browser, disable its caches, and direct it to the local
# server. We re-open this app every time we quit (to faciliate the common
# pattern of restarting your browser when testing code) until Ctrl+C is sent to
# this script in the terminal.
########

server_port="8888"
# TODO: Have Python only listen on loopback address
server_addr="127.0.0.1"


# Output message colors
message_color="$(tput bold)$(tput setab 6)"
quit_color="$(tput bold)$(tput setab 1)"
reset_color="$(tput sgr0)"

# TODO: Do we want to `cd` to the location of this script before serving files,
# or stay in the same directory to allow us to serve different directories?

# The command to run a web server, serving this directory
if type 'serve' 2>&1 >/dev/null; then
	# Some of our dev machines have the 'serve' command. If present, use that
	server='serve'
else
	# If `serve` isn't found, just use a Python SimpleHTTPServer
	server="python -m SimpleHTTPServer $server_port"
fi


# If $WEBKITWEBCL_PATH isn't set, and ~/.superconductorrc exists, source it and
# then check if $WEBKITWEBCL_PATH exists again
if [ -z $WEBKITWEBCL_PATH ] && [ -e ~/.webkitwebcl ]; then
	. ~/.webkitwebcl
fi
if [ -z  $WEBKITWEBCL_PATH ]; then
	printf '\n%sCould not find WebKit WebCL app. Not launching app; just running server.%s\n\n' "$quit_color" "$reset_color"
	printf '%sTo change this, set the $WEBKITWEBCL_PATH variable in your environment, or in%s\n' "$quit_color" "$reset_color"
	printf '%s~/.webkitwebcl.%s\n\n' "$quit_color" "$reset_color"

	${server}
	exit
fi

webkit_path="$WEBKITWEBCL_PATH" #"/Users/mtorok/Documents/repositories/Safari-WebCL-latest/WebKit.app"



# Run the server in the background, but save its PID so we can kill it when this script exits
${server} &
server_pid="$!"



# Tell WebKit WebCL to not save/restore window on exit/launch
defaults write org.webkit.nightly.WebKit ApplePersistenceIgnoreState 0


# The AppleScript to launch WebKit WebCL, disable its caches, and open the page to the local server
launch_script=$(cat <<APPLESCRIPT
tell application "$webkit_path" to activate

tell application "System Events"
	-- set SafariCL to application process "WebKit"
	-- set frontmost of SafariCL to true
	tell process "WebKit"
		tell menu bar 1
			tell menu "Develop"
				click menu item "Empty Caches"
				if (value of attribute "AXMenuItemMarkChar" of menu item "Disable Caches") ≠ "✓" then
					click menu item "Disable Caches"
				end if
			end tell
		end tell
	end tell
end tell

tell application "/Users/mtorok/Documents/repositories/Safari-WebCL-latest/WebKit.app"
	tell window 1
		set URL of current tab to "http://${server_addr}:${server_port}" --:${server_port}
	end tell
end tell

APPLESCRIPT
)

# The AppleScript to quit WebKit WebCL (called when this script exits)
quit_script=$(cat <<APPLESCRIPT
	tell application "$webkit_path"
		if it is running then
			quit
		end if
	end tell
APPLESCRIPT
)


# The code to run when we exit (either by pressing Ctrl+C, or other means)
trapped() {
	# do_run=
	if [[ -n $quit_script ]]; then
		echo "$quit_script" | osascript -
	fi
	if [[ $server_pid ]]; then
		echo "Killing web server"
		kill $server_pid 2>/dev/null
	fi

	printf "\n%sExiting...%s\n\n" "$quit_color" "$reset_color"
	exit
}


# Infinitely re-launch WebKit WebCL, until Ctrl+C is called
while :
do
	echo "$launch_script" | osascript -
	trap trapped SIGINT
	open -W -a "$webkit_path" >/dev/null

	printf "\n%sRelaunching Safari. Press Ctrl+C to stop.%s\n\n" "$message_color" "$reset_color"
done

trapped