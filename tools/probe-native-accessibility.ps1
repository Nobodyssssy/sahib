param([long]$Handle,[switch]$Invoke,[switch]$Focus)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$element=[Windows.Automation.AutomationElement]::FromHandle([IntPtr]$Handle)
if(!$element){throw 'UI Automation element unavailable'}
$current=$element.Current
$pattern=$null;$supported=$element.TryGetCurrentPattern([Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)
$result=[ordered]@{name=$current.Name;automationId=$current.AutomationId;controlType=$current.ControlType.ProgrammaticName;help=$current.HelpText;keyboardFocusable=$current.IsKeyboardFocusable;enabled=$current.IsEnabled;offscreen=$current.IsOffscreen;bounds=$current.BoundingRectangle.ToString();invokeSupported=$supported}
if($Focus){try{$element.SetFocus();$result.focused=$true}catch{$result.focused=$false;$result.focusError=$_.Exception.Message}}
if($Invoke){if(!$supported){throw 'Invoke pattern unavailable'};$pattern.Invoke();$result.invoked=$true}
$result | ConvertTo-Json -Compress
